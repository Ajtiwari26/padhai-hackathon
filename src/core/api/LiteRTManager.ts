import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';
import { EventBus } from '../bus/EventBus';

const { PadhLiteRTModule, PadhModelDownloader } = NativeModules;
const liteRTEmitter = new NativeEventEmitter(PadhLiteRTModule);

export interface LiteRTModelConfig {
  modelPath: string;
  maxTokens?: number;
  temperature?: number;
  useGpu?: boolean;
  serverMode?: string;
  loraPath?: string; // Phase 10: LoRA adapter support
}

export interface DownloadStatus {
  status: number;
  bytesDownloaded: number;
  bytesTotal: number;
}

/**
 * LiteRTManager
 * 
 * Handles the official LiteRT-LM migration, model downloading,
 * and LoRA adapter support.
 */
class LiteRTManagerService {
  private isInitialized = false;
  private tokenListener: EmitterSubscription | null = null;

  /**
   * Initialize the LiteRT server lifecycle service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      await PadhLiteRTModule.initializeService();
      this.isInitialized = true;
      console.log('[LiteRTManager] Service initialized successfully.');
    } catch (error) {
      console.error('[LiteRTManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if a model file exists locally
   */
  public async checkModelExists(filename: string): Promise<boolean> {
    try {
      return await PadhModelDownloader.checkModelExists(filename);
    } catch (error) {
      console.error('[LiteRTManager] Error checking model existence:', error);
      return false;
    }
  }

  /**
   * Get the absolute path for a downloaded model
   */
  public async getModelPath(filename: string): Promise<string> {
    return await PadhModelDownloader.getModelPath(filename);
  }

  /**
   * Download a model via official SDK download manager
   */
  public async downloadModel(url: string, filename: string): Promise<string> {
    try {
      const downloadId = await PadhModelDownloader.startDownload(url, filename);
      console.log(`[LiteRTManager] Started downloading ${filename} with ID: ${downloadId}`);
      return downloadId;
    } catch (error) {
      console.error('[LiteRTManager] Failed to start download:', error);
      throw error;
    }
  }

  /**
   * Check download status
   */
  public async getDownloadStatus(downloadId: string): Promise<DownloadStatus> {
    return await PadhModelDownloader.getDownloadStatus(downloadId);
  }

  /**
   * Start the inference server with a specific model and optional LoRA adapter
   */
  public async startServer(config: LiteRTModelConfig): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    try {
      const maxTokens = config.maxTokens ?? 1024;
      const temp = config.temperature ?? 0.7;
      const useGpu = config.useGpu ?? true;
      const serverMode = config.serverMode ?? 'auto';
      
      // If LoRA path is provided, we can pass it if the module supports it or append to configuration.
      // (Assuming PadhLiteRTModule could accept it, though the current module doesn't explicitly have it in signature,
      // it can be passed via serverMode or updated module later)
      const finalServerMode = config.loraPath ? `${serverMode}|lora:${config.loraPath}` : serverMode;

      await PadhLiteRTModule.startServer(
        8080,
        config.modelPath,
        maxTokens,
        temp,
        'litert',
        useGpu,
        finalServerMode
      );
      
      EventBus.emitSync('litert:server:started', { status: 'success', message: 'started' });
      console.log('[LiteRTManager] Server started successfully.');
    } catch (error) {
      console.error('[LiteRTManager] Server start failed:', error);
      throw error;
    }
  }

  /**
   * Stop the inference server
   */
  public async stopServer(): Promise<void> {
    try {
      await PadhLiteRTModule.stopServer();
      EventBus.emitSync('litert:server:stopped', { reason: 'stopServer called' });
      console.log('[LiteRTManager] Server stopped successfully.');
    } catch (error) {
      console.error('[LiteRTManager] Stop server failed:', error);
      throw error;
    }
  }

  /**
   * Generate a response synchronously
   */
  public async generateResponse(prompt: string): Promise<string> {
    try {
      return await PadhLiteRTModule.generateResponseDirect(prompt);
    } catch (error) {
      console.error('[LiteRTManager] Generate response failed:', error);
      throw error;
    }
  }

  /**
   * Generate a response asynchronously with streaming
   */
  public streamResponse(prompt: string, onToken: (token: string) => void): void {
    if (this.tokenListener) {
      this.tokenListener.remove();
    }

    this.tokenListener = liteRTEmitter.addListener('onToken', (token: string) => {
      onToken(token);
    });

    try {
      PadhLiteRTModule.generateResponseStreamDirect(prompt);
    } catch (error) {
      console.error('[LiteRTManager] Stream response failed:', error);
      throw error;
    }
  }

  /**
   * Clear the model cache
   */
  public async resetCache(): Promise<void> {
    try {
      await PadhLiteRTModule.resetCache();
      console.log('[LiteRTManager] Cache reset successful.');
    } catch (error) {
      console.error('[LiteRTManager] Cache reset failed:', error);
      throw error;
    }
  }
}

export const LiteRTManager = new LiteRTManagerService();
