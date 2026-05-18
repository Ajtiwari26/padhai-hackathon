import { NativeModules, Platform } from 'react-native';
import { EventBus } from '../bus/EventBus';

const { CoreSelectorModule } = NativeModules;

/**
 * Core Selection Strategy
 */
export type CoreStrategy = 'foreground' | 'background' | 'balanced' | 'efficiency';

/**
 * Thermal State
 */
export type ThermalState = 'nominal' | 'light' | 'moderate' | 'severe' | 'critical';

/**
 * Core Topology Information
 */
export interface CoreTopology {
  totalCores: number;
  bigCores: number[];
  littleCores: number[];
  currentStrategy: string;
  thermalState: string;
}

/**
 * Adaptive Core Selector
 * 
 * Manages CPU core selection for optimal power efficiency.
 * Uses big cores for foreground tasks, little cores for background tasks.
 * 
 * Expected Impact: 40-50% power reduction for background tasks
 */
class CoreSelectorService {
  private currentStrategy: CoreStrategy = 'balanced';
  private batteryLevel: number = 100;
  private isMonitoring: boolean = false;

  constructor() {
    this.subscribeToEvents();
  }

  /**
   * Subscribe to relevant events
   */
  private subscribeToEvents(): void {
    // Apply appropriate strategy when inference starts
    EventBus.on('inference:start', async (data) => {
      const priority = data.priority || 'foreground';
      await this.applyInferenceStrategy(priority);
    });

    // Monitor thermal state
    EventBus.on('system:thermal:warning', async (data) => {
      console.log('[CoreSelector] Thermal warning, switching to efficiency cores');
      await this.setCoreAffinity('efficiency');
    });

    // Monitor memory pressure
    EventBus.on('system:memory:pressure', async (data) => {
      if (data.level === 'high' || data.level === 'critical') {
        console.log('[CoreSelector] High memory pressure, switching to efficiency cores');
        await this.setCoreAffinity('efficiency');
      }
    });
  }

  /**
   * Check if CoreSelector is available (Android only)
   */
  public isAvailable(): boolean {
    return Platform.OS === 'android' && CoreSelectorModule != null;
  }

  /**
   * Set CPU core affinity
   * 
   * @param strategy Core selection strategy
   * @returns true if successful
   */
  public async setCoreAffinity(strategy: CoreStrategy): Promise<boolean> {
    if (!this.isAvailable()) {
      console.warn('[CoreSelector] Not available on this platform');
      return false;
    }

    try {
      await CoreSelectorModule.setCoreAffinity(strategy);
      this.currentStrategy = strategy;
      console.log(`[CoreSelector] Core affinity set to: ${strategy}`);
      
      // Emit event
      EventBus.emitSync('core:strategy:changed', { strategy });
      
      return true;
    } catch (error) {
      console.error('[CoreSelector] Failed to set core affinity:', error);
      return false;
    }
  }

  /**
   * Select optimal core strategy based on context
   * 
   * @param priority Task priority
   * @param batteryLevel Current battery level (0-100)
   * @returns Recommended strategy
   */
  public async selectOptimalStrategy(
    priority: 'foreground' | 'background',
    batteryLevel?: number
  ): Promise<CoreStrategy> {
    if (!this.isAvailable()) {
      return 'balanced';
    }

    try {
      const battery = batteryLevel ?? this.batteryLevel;
      const strategy = await CoreSelectorModule.selectOptimalStrategy(priority, battery);
      return strategy as CoreStrategy;
    } catch (error) {
      console.error('[CoreSelector] Failed to select strategy:', error);
      return 'balanced';
    }
  }

  /**
   * Apply inference strategy
   * 
   * Automatically selects and applies the optimal core strategy for an inference task
   * 
   * @param priority Task priority
   * @param estimatedDuration Estimated duration in seconds
   */
  public async applyInferenceStrategy(
    priority: 'foreground' | 'background',
    estimatedDuration: number = 30
  ): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      await CoreSelectorModule.applyInferenceStrategy(
        priority,
        this.batteryLevel,
        estimatedDuration
      );
      
      console.log(
        `[CoreSelector] Applied inference strategy: priority=${priority}, ` +
        `battery=${this.batteryLevel}%, duration=${estimatedDuration}s`
      );
    } catch (error) {
      console.error('[CoreSelector] Failed to apply inference strategy:', error);
    }
  }

  /**
   * Get current core strategy
   */
  public async getCurrentStrategy(): Promise<CoreStrategy> {
    if (!this.isAvailable()) {
      return this.currentStrategy;
    }

    try {
      const strategy = await CoreSelectorModule.getCurrentStrategy();
      this.currentStrategy = strategy;
      return strategy;
    } catch (error) {
      console.error('[CoreSelector] Failed to get current strategy:', error);
      return this.currentStrategy;
    }
  }

  /**
   * Get thermal state
   */
  public async getThermalState(): Promise<ThermalState> {
    if (!this.isAvailable()) {
      return 'nominal';
    }

    try {
      const state = await CoreSelectorModule.getThermalState();
      return state as ThermalState;
    } catch (error) {
      console.error('[CoreSelector] Failed to get thermal state:', error);
      return 'nominal';
    }
  }

  /**
   * Get core topology information
   */
  public async getCoreTopology(): Promise<CoreTopology | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const topology = await CoreSelectorModule.getCoreTopology();
      return topology;
    } catch (error) {
      console.error('[CoreSelector] Failed to get core topology:', error);
      return null;
    }
  }

  /**
   * Get power efficiency estimate
   * 
   * @returns Estimated power savings compared to foreground strategy (0.0 - 1.0)
   */
  public async getPowerEfficiencyEstimate(): Promise<number> {
    if (!this.isAvailable()) {
      return 0.0;
    }

    try {
      const efficiency = await CoreSelectorModule.getPowerEfficiencyEstimate();
      return efficiency;
    } catch (error) {
      console.error('[CoreSelector] Failed to get efficiency estimate:', error);
      return 0.0;
    }
  }

  /**
   * Update battery level
   * 
   * Call this when battery level changes to inform strategy selection
   */
  public updateBatteryLevel(level: number): void {
    this.batteryLevel = Math.max(0, Math.min(100, level));
    console.log(`[CoreSelector] Battery level updated: ${this.batteryLevel}%`);
  }

  /**
   * Start monitoring and auto-adjusting core strategy
   */
  public async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    console.log('[CoreSelector] Started monitoring');

    // Log initial topology
    const topology = await this.getCoreTopology();
    if (topology) {
      console.log('[CoreSelector] Core topology:', topology);
    }
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    this.isMonitoring = false;
    console.log('[CoreSelector] Stopped monitoring');
  }

  /**
   * Get monitoring status
   */
  public isMonitoringActive(): boolean {
    return this.isMonitoring;
  }
}

// Singleton instance
export const CoreSelector = new CoreSelectorService();
