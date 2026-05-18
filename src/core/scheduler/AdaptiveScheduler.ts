import { EventBus } from '../bus/EventBus';
import { ResourcePlanner } from '../planner/ResourcePlanner';

class AdaptiveSchedulerService {
  private memoryLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  private thermalState: string = 'nominal';
  private isForegroundInferenceRunning = false;

  constructor() {
    // We will start listening when the app starts or when this module is loaded
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    EventBus.on('system:memory:pressure', (data: { level: 'low' | 'medium' | 'high' | 'critical', usedMB: number }) => {
      console.log(`[AdaptiveScheduler] Memory pressure event: ${data.level} (${data.usedMB} MB)`);
      this.memoryLevel = data.level;
      this.adjustScheduling();
    });

    EventBus.on('system:thermal:warning', (data: { state: "critical" | "nominal" | "light" | "moderate" | "severe", temp?: number }) => {
      console.log(`[AdaptiveScheduler] Thermal warning event: ${data.state} (${data.temp !== undefined ? data.temp : 'N/A'}°C)`);
      this.thermalState = data.state;
      this.adjustScheduling();
    });

    EventBus.on('inference:start', (data: { priority: string }) => {
      if (data.priority === 'foreground') {
        console.log('[AdaptiveScheduler] Foreground inference started');
        this.isForegroundInferenceRunning = true;
        this.adjustScheduling();
      }
    });

    EventBus.on('inference:end', (data: { priority: string }) => {
      if (data.priority === 'foreground') {
        console.log('[AdaptiveScheduler] Foreground inference ended');
        this.isForegroundInferenceRunning = false;
        this.adjustScheduling();
      }
    });
  }

  private adjustScheduling() {
    // Determine if we should pause or slow down background tasks
    const shouldPause = 
      this.isForegroundInferenceRunning || 
      this.memoryLevel === 'critical' || 
      this.memoryLevel === 'high' ||
      this.thermalState === 'critical' ||
      this.thermalState === 'severe';

    const currentlyPaused = ResourcePlanner.isPausedStatus();

    if (shouldPause && !currentlyPaused) {
      console.log('[AdaptiveScheduler] ⏸️ Pausing background tasks due to system pressure or foreground activity');
      ResourcePlanner.pause();
    } else if (!shouldPause && currentlyPaused) {
      console.log('[AdaptiveScheduler] ▶️ Resuming background tasks as system pressure is low');
      ResourcePlanner.resume();
    }
  }

  /**
   * Initialize the scheduler (can be called from App init)
   */
  public init() {
    console.log('[AdaptiveScheduler] Initialized');
  }
}

export const AdaptiveScheduler = new AdaptiveSchedulerService();
