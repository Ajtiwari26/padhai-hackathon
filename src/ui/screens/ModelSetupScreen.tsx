import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Dimensions, Animated, ScrollView, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme/theme';
import { LocalServerManager, LocalServerConfig, InferenceRuntime } from '../../core/api/LocalServerManager';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ModelProps {
  id: string;
  name: string;
  sizeGb: number;
  description: string;
  purpose: string;
  benchmarkScore: number;
  url: string;
  runtime: 'litert' | 'mediapipe';
}

const RECOMMENDED_MODELS: ModelProps[] = [
  { 
    id: 'gemma-4-E2B-it.litertlm', 
    name: 'Gemma 4 E2B IT ⚡', 
    sizeGb: 2.58, 
    purpose: 'Fast & Efficient', 
    benchmarkScore: 92, 
    description: 'Perfect for most devices. Optimized for speed.',
    url: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm',
    runtime: 'litert'
  },
  { 
    id: 'gemma-4-E4B-it.litertlm', 
    name: 'Gemma 4 E4B IT 🔥', 
    sizeGb: 3.65, 
    purpose: 'Smart & Precise', 
    benchmarkScore: 94, 
    description: 'Better reasoning but requires more RAM (6GB+).',
    url: 'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it.litertlm',
    runtime: 'litert'
  },
  { 
    id: 'gemma3-1b-it-int4.task', 
    name: 'Gemma 3 1B IT', 
    sizeGb: 0.55, 
    purpose: 'Ultra Lightweight', 
    benchmarkScore: 82, 
    description: 'Smallest model. Ideal for older devices.',
    url: 'https://huggingface.co/google/gemma-2-2b-it-GGUF/resolve/main/2b_it_v2_q4_0.gguf',
    runtime: 'mediapipe'
  },
  { 
    id: 'deepseek_q8_ekv1280.task', 
    name: 'DeepSeek R1 1.5B', 
    sizeGb: 1.86, 
    purpose: 'Advanced Reasoning', 
    benchmarkScore: 90, 
    description: 'Distilled Qwen 1.5B with chain-of-thought.',
    url: 'https://huggingface.co/litert-community/DeepSeek-R1-Distill-Qwen-1.5B/resolve/main/deepseek_q8_ekv1280.task',
    runtime: 'mediapipe'
  },
];

interface Props {
  onFinish: () => void;
  onSkip?: () => void;
}

export const ModelSetupScreen: React.FC<Props> = ({ onFinish, onSkip }) => {
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [downloadInfo, setDownloadInfo] = useState<{
    id: string;
    nativeDownloadId: string;
    bytesDownloaded: number;
    bytesTotal: number;
    speedMBps: number;
    lastUpdateMs: number;
    progress: number;
  } | null>(null);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
    
    checkLocalModels();
  }, []);

  const checkLocalModels = async () => {
    const existing = [];
    for (const model of RECOMMENDED_MODELS) {
      if (await LocalServerManager.checkModelExists(model.id)) {
        existing.push(model.id);
      }
    }
    setDownloadedModels(existing);
    
    // Auto-select if only one exists
    if (existing.length > 0) {
      setActiveModelId(existing[0]);
    }
  };

  useEffect(() => {
    if (!downloadInfo?.nativeDownloadId) return;

    const interval = setInterval(async () => {
      try {
        const status = await LocalServerManager.getDownloadStatus(downloadInfo.nativeDownloadId);
        if (status) {
          // DownloadManager Status codes: 8 = SUCCESSFUL, 16 = FAILED
          if (status.status === 8) {
             setDownloadedModels(prev => [...prev, downloadInfo.id]);
             setDownloadInfo(null);
             setDownloadingModelId(null);
             setActiveModelId(downloadInfo.id);
             Alert.alert("Success", "Model downloaded successfully!");
          } else if (status.status === 16) {
             setDownloadInfo(null);
             setDownloadingModelId(null);
             Alert.alert("Error", "Download failed. Check connection.");
          } else {
            setDownloadInfo(prev => {
              if (!prev) return null;
              const now = Date.now();
              const bytesDiff = status.bytesDownloaded - prev.bytesDownloaded;
              let speedMBps = prev.speedMBps || 0;
              let lastUpdateMs = prev.lastUpdateMs;
              const progress = status.bytesTotal > 0 ? Math.round((status.bytesDownloaded / status.bytesTotal) * 100) : 0;

              if (bytesDiff > 0) {
                const timeDiffS = (now - prev.lastUpdateMs) / 1000;
                const currentSpeedMBps = (bytesDiff / (1024 * 1024)) / (timeDiffS || 1);
                speedMBps = prev.speedMBps === 0 ? currentSpeedMBps : (currentSpeedMBps * 0.3) + (prev.speedMBps * 0.7);
                lastUpdateMs = now;
              }

              return {
                ...prev,
                bytesDownloaded: status.bytesDownloaded,
                bytesTotal: status.bytesTotal,
                speedMBps,
                lastUpdateMs,
                progress
              };
            });
          }
        }
      } catch (e) {
        console.error("Polling Error:", e);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [downloadInfo?.nativeDownloadId]);

  const handleDownload = async (model: ModelProps) => {
    try {
      setDownloadingModelId(model.id);
      const filename = model.url.split('/').pop() || `${model.id}.task`;
      const nativeId = await LocalServerManager.startModelDownload(model.url, filename);
      
      setDownloadInfo({
        id: model.id,
        nativeDownloadId: nativeId,
        bytesDownloaded: 0,
        bytesTotal: 0,
        speedMBps: 0,
        lastUpdateMs: Date.now(),
        progress: 0
      });
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to start download.");
      setDownloadingModelId(null);
    }
  };

  const handleStartOnboarding = async () => {
    if (!activeModelId) return;
    
    try {
      setIsStarting(true);
      const modelPath = await LocalServerManager.getModelPath(activeModelId);
      console.log("Igniting engine with model:", modelPath);
      
      const config = await LocalServerManager.getConfig();
      const selectedModel = RECOMMENDED_MODELS.find(m => m.id === activeModelId);
      
      const success = await LocalServerManager.startServer({
        ...config,
        enabled: true,
        modelId: activeModelId,
        modelPath: modelPath,
        runtime: (selectedModel?.runtime as InferenceRuntime) || 'litert',
      });

      if (success) {
        // Wait for server to be fully ready (model loaded and server started)
        console.log("Waiting for server to be fully ready...");
        let retries = 0;
        const maxRetries = 20; // 20 seconds max wait
        
        while (retries < maxRetries) {
          const isReady = await LocalServerManager.isRunning();
          if (isReady) {
            console.log("Server is ready!");
            break;
          }
          await new Promise(resolve => setTimeout(() => resolve(null), 1000));
          retries++;
        }
        
        if (retries >= maxRetries) {
          throw new Error("Server started but didn't become ready in time.");
        }
        
        // Give it one more second to stabilize
        await new Promise(resolve => setTimeout(() => resolve(null), 1000));
        onFinish();
      } else {
        throw new Error("Failed to ignite engine.");
      }
    } catch (e: any) {
      setIsStarting(false);
      Alert.alert("Error", e.message || "Engine startup failed. This often happens if the device is low on RAM or if the model file is corrupted.");
    }
  };


  const renderModelCard = (model: ModelProps) => {
    const isDownloading = downloadingModelId === model.id;
    const isDownloaded = downloadedModels.includes(model.id);
    const isActive = activeModelId === model.id;

    return (
      <View key={model.id} style={[styles.modelCard, isActive && styles.modelCardActive]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.modelName}>{model.name}</Text>
            <Text style={styles.modelPurpose}>{model.purpose}</Text>
          </View>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>IQ {model.benchmarkScore}</Text>
          </View>
        </View>
        
        <Text style={styles.modelDesc}>{model.description}</Text>
        
        {isDownloading ? (
          <View style={styles.downloadContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${downloadInfo?.progress || 0}%` }]} />
            </View>
            <View style={styles.progressInfo}>
              <Text style={styles.progressSub}>
                {downloadInfo?.speedMBps.toFixed(1)} MB/s • {downloadInfo?.progress}%
              </Text>
              <Text style={styles.progressSub}>
                {model.sizeGb} GB
              </Text>
            </View>
          </View>
        ) : isDownloaded ? (
          <TouchableOpacity 
            style={[styles.actionBtn, isActive ? styles.activeBtn : styles.selectBtn]} 
            onPress={() => setActiveModelId(model.id)}
          >
            <Text style={[styles.actionBtnText, isActive ? styles.activeBtnText : styles.selectBtnText]}>
              {isActive ? 'SELECTED' : 'SELECT MODEL'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.downloadBtn} 
            onPress={() => handleDownload(model)}
            disabled={downloadingModelId !== null}
          >
            <Text style={styles.downloadBtnText}>DOWNLOAD ({model.sizeGb}GB)</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={styles.header}>
            <Text style={styles.logoText}>padh[AI]</Text>
            <Text style={styles.title}>Ignite your local engine</Text>
            <Text style={styles.subtitle}>
              Pick a model to download. Padh.ai runs 100% locally for maximum privacy and zero latency.
            </Text>
          </View>

          <View style={styles.modelList}>
            {RECOMMENDED_MODELS.map(renderModelCard)}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.startBtn, (!activeModelId || isStarting) && styles.startBtnDisabled]}
            disabled={!activeModelId || isStarting}
            onPress={handleStartOnboarding}
          >
            {isStarting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.startBtnText}>START ONBOARDING</Text>
            )}
          </TouchableOpacity>
          
          {onSkip && (
            <TouchableOpacity 
              style={[styles.skipBtn, { marginTop: 12, borderBottomWidth: 1, borderBottomColor: Theme.colors.textMuted + '40' }]}
              onPress={onSkip}
            >
              <Text style={styles.skipBtnText}>Skip for now (Configure later in Settings)</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    marginTop: 20,
    marginBottom: 32,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '300',
    color: Theme.colors.primary,
    letterSpacing: 4,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: Theme.colors.textMuted,
    lineHeight: 22,
  },
  modelList: {
    gap: 20,
  },
  modelCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  modelCardActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primary + '08',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modelName: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  modelPurpose: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.primary,
    textTransform: 'uppercase',
  },
  scoreBadge: {
    backgroundColor: Theme.colors.surfaceHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFB000',
  },
  modelDesc: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  downloadBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  downloadBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  selectBtn: {
    borderColor: Theme.colors.primary,
    backgroundColor: 'transparent',
  },
  activeBtn: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  actionBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  selectBtnText: {
    color: Theme.colors.primary,
  },
  activeBtnText: {
    color: '#FFF',
  },
  downloadContainer: {
    marginTop: 4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Theme.colors.surfaceHigh,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.primary,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressSub: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: Theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  startBtn: {
    backgroundColor: Theme.colors.primary,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  startBtnDisabled: {
    backgroundColor: Theme.colors.surfaceHigh,
    shadowOpacity: 0,
  },
  startBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  skipBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipBtnText: {
    color: Theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
});
