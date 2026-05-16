import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { PadhLocalServer, PadhModelDownloader } = NativeModules;

// Suppress NativeEventEmitter warnings
if (PadhLocalServer) {
  if (!PadhLocalServer.addListener) PadhLocalServer.addListener = () => {};
  if (!PadhLocalServer.removeListeners) PadhLocalServer.removeListeners = () => {};
}

const PadhLiteRTEmitter = PadhLocalServer ? new NativeEventEmitter(PadhLocalServer) : null;

export type InferenceRuntime = 'mediapipe' | 'litert';
export type ServerMode = 'kill_on_close' | 'auto_sleep' | 'always_active';

export interface LocalServerConfig {
  enabled: boolean;
  port: number;
  modelId: string;
  modelPath: string;
  temperature: number;
  maxTokens: number;
  maxOutputTokens: number;
  contextWindowSize: number;
  systemPrompt: string;
  runtime: InferenceRuntime;
  useGpu: boolean;
  extendedThinking: boolean;
  serverMode: ServerMode;
  topP: number;
}

export class LocalServerManager {
  private static readonly STORAGE_KEY = '@padhai_local_server_config';
  private static modelStatusListeners: Array<(status: any) => void> = [];
  private static statusSubscription: EmitterSubscription | null = null;
  
  // Auto-pause configuration
  private static idleTimeout = 60000; // 60 seconds
  private static lastActivityTime = Date.now();
  private static idleCheckInterval: NodeJS.Timeout | null = null;
  private static isPaused = false;

  static async initialize(): Promise<void> {
    try {
      if (PadhLocalServer && PadhLocalServer.initializeService) {
        // Add a safety timeout to prevent hanging the whole JS boot
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Native initialization timed out')), 5000)
        );
        
        await Promise.race([
          PadhLocalServer.initializeService(),
          timeoutPromise
        ]).catch(e => console.warn("[LocalServerManager] Service init timeout or error:", e));
      }

      // Setup Native Event Listeners for Server Status
      if (PadhLiteRTEmitter && !this.statusSubscription) {
        this.statusSubscription = PadhLiteRTEmitter.addListener('onServerStatusChanged', (event) => {
          this.modelStatusListeners.forEach(listener => listener(event));
        });
      }
      
      const config = await this.getConfig();
      if (config.enabled && config.modelPath) {
         // Start server in background; don't await to avoid blocking UI boot
         this.startServer(config).catch(e => console.warn("Failed to auto-start server:", e));
      }
      
      // Start idle monitoring
      this.startIdleMonitoring();
    } catch (e) {
      console.warn("Failed to initialize Padh.ai Native Local Server", e);
    }
  }

  /**
   * Monitor idle time and auto-pause engine after timeout
   */
  private static startIdleMonitoring(): void {
    this.idleCheckInterval = setInterval(() => {
      const idleTime = Date.now() - this.lastActivityTime;
      
      if (idleTime > this.idleTimeout && !this.isPaused) {
        console.log(`[LocalServerManager] 💤 Auto-pausing after ${idleTime / 1000}s idle`);
        this.pauseServer();
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Pause the inference engine
   */
  private static async pauseServer(): Promise<void> {
    if (this.isPaused) return;
    
    console.log('[LocalServerManager] Pausing inference engine');
    this.isPaused = true;
    
    try {
      if (PadhLocalServer?.pause) {
        await PadhLocalServer.pause();
      }
    } catch (e) {
      console.error('[LocalServerManager] Failed to pause engine:', e);
    }
  }

  /**
   * Resume the inference engine
   */
  private static async resumeServer(): Promise<void> {
    if (!this.isPaused) return;
    
    console.log('[LocalServerManager] Resuming inference engine');
    this.isPaused = false;
    
    try {
      if (PadhLocalServer?.resume) {
        await PadhLocalServer.resume();
      }
    } catch (e) {
      console.error('[LocalServerManager] Failed to resume engine:', e);
    }
  }

  /**
   * Record activity to prevent auto-pause
   * Call this before every inference request
   */
  static recordActivity(): void {
    this.lastActivityTime = Date.now();
    
    // Auto-resume if paused
    if (this.isPaused) {
      this.resumeServer();
    }
  }

  /**
   * Stop monitoring on shutdown
   */
  static shutdown(): void {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
    } catch (e) {
      console.warn("Failed to initialize Padh.ai Native Local Server", e);
    }
  }

  static async getConfig(): Promise<LocalServerConfig> {
    const defaults: LocalServerConfig = {
      enabled: false,
      port: 8080,
      modelId: '',
      modelPath: '',
      temperature: 0.2, 
      maxTokens: 8192,
      maxOutputTokens: -1, // Dynamic: -1 means no fixed limit, adapts to response
      contextWindowSize: 4,
      systemPrompt: 'You are Padh.ai, a strict Socratic AI tutor. Do not give direct answers.',
      runtime: 'litert',
      useGpu: true,
      extendedThinking: true,
      serverMode: 'auto_sleep',
      topP: 0.95,
    };
    try {
      const raw = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!raw) return defaults;
      return { ...defaults, ...JSON.parse(raw) };
    } catch(e) {
      return defaults;
    }
  }

  static async saveConfig(config: LocalServerConfig): Promise<void> {
    await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
  }

  static async startServer(config: LocalServerConfig): Promise<boolean> {
    try {
      // Save the config first so it persists
      await this.saveConfig(config);
      
      return await PadhLocalServer.startServer(
        config.port,
        config.modelPath,
        config.maxTokens,
        config.temperature,
        config.runtime || 'litert',
        config.useGpu !== undefined ? config.useGpu : true,
        config.serverMode || 'auto_sleep'
      );
    } catch (e) {
      console.error("LocalServer start error:", e);
      return false;
    }
  }

  static async stopServer(): Promise<void> {
    try {
      if (!PadhLocalServer) return;
      await PadhLocalServer.stopServer();
    } catch (e) {
      console.error("LocalServer stop error:", e);
    }
  }

  static async resetCache(): Promise<boolean> {
    try {
      if (!PadhLocalServer) return false;
      await PadhLocalServer.resetCache();
      return true;
    } catch (e) {
      console.error("LocalServer reset cache error:", e);
      return false;
    }
  }

  static async isRunning(): Promise<boolean> {
    try {
      if (PadhLocalServer) {
        return await PadhLocalServer.getServerStatus();
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  static addStatusListener(listener: (status: any) => void) {
    this.modelStatusListeners.push(listener);
    return () => {
      this.modelStatusListeners = this.modelStatusListeners.filter(l => l !== listener);
    };
  }

  // --- Downloader Wrapper ---

  static async checkModelExists(modelId: string): Promise<boolean> {
    try {
      if (!PadhModelDownloader) return false;
      // We pass the expected filename
      const filename = modelId.includes('.task') || modelId.includes('.litertlm') 
        ? modelId 
        : `${modelId}.task`;
      return await PadhModelDownloader.checkModelExists(filename);
    } catch (e) {
      return false;
    }
  }

  static async getModelPath(modelId: string): Promise<string> {
    try {
      if (!PadhModelDownloader) return "";
      const filename = modelId.includes('.task') || modelId.includes('.litertlm') 
        ? modelId 
        : `${modelId}.task`;
      return await PadhModelDownloader.getModelPath(filename);
    } catch (e) {
      return "";
    }
  }

  static async startModelDownload(
    url: string, 
    filename: string
  ): Promise<string> {
    try {
      if (!PadhModelDownloader) throw new Error("Native PadhModelDownloader not linked.");
      return await PadhModelDownloader.startDownload(url, filename);
    } catch (e) {
      console.error("Downloader Error:", e);
      throw e;
    }
  }

  static async getDownloadStatus(downloadId: string): Promise<{status: number, bytesDownloaded: number, bytesTotal: number}> {
    if (!PadhModelDownloader) return {status: 0, bytesDownloaded: 0, bytesTotal: 0};
    return await PadhModelDownloader.getDownloadStatus(downloadId);
  }

  static async cancelDownload(downloadId: string): Promise<void> {
    if (!PadhModelDownloader) return;
    await PadhModelDownloader.cancelDownload(downloadId);
  }
}
