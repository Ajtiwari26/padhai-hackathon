import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Dimensions, Animated, ScrollView, Alert, Linking, TextInput,
  PermissionsAndroid, Platform, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme/theme';
import { LocalServerManager, LocalServerConfig, InferenceRuntime } from '../../core/api/LocalServerManager';
import { Eye, EyeOff, ExternalLink, Server, Globe, RefreshCw, FolderOpen } from 'lucide-react-native';
import { ModelManager } from '../../core/api/ModelManager';
// New imports for file picking and filesystem operations
import DocumentPicker, { DocumentPickerResponse } from 'react-native-document-picker';


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
    name: 'Gemma 4 E2B IT', 
    sizeGb: 2.58, 
    purpose: 'Fast & Efficient', 
    benchmarkScore: 92, 
    description: 'Perfect for most devices. Optimized for speed.',
    url: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm',
    runtime: 'litert'
  },
  { 
    id: 'gemma-4-E4B-it.litertlm', 
    name: 'Gemma 4 E4B IT', 
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

interface GroqModelProps {
  id: string;
  name: string;
  iq: number;
  cost: string;
  description: string;
  details: string;
}

const GROQ_MODELS: GroqModelProps[] = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    iq: 90,
    cost: 'Medium Burn',
    description: 'Balanced General IQ',
    details: 'Highly versatile, great for conversations and general tasks.'
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B',
    iq: 75,
    cost: 'Low Burn',
    description: 'Ultra Speed (1000+ t/s)',
    details: 'Extremely fast querying and low resource usage.'
  },
  {
    id: 'gemma2-9b-it',
    name: 'Gemma 2 9B IT',
    iq: 82,
    cost: 'Low-Medium Burn',
    description: 'Google\'s 9B instruction model',
    details: 'Good for general tutoring and precise instructions.'
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B',
    iq: 85,
    cost: 'Medium Burn',
    description: 'Mixture of Experts model',
    details: 'High-quality responses and large context window.'
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 70B',
    iq: 95,
    cost: 'High Burn',
    description: 'Advanced reasoning model',
    details: 'Superb step-by-step reasoning distilled from DeepSeek R1.'
  }
];

const mapGroqModelsForSetup = (fetchedModels: any[]): GroqModelProps[] => {
  if (!fetchedModels || fetchedModels.length === 0) return GROQ_MODELS;
  
  const formatId = (id: string): string => {
    return id
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .replace('Distill', 'Distilled')
      .replace('It', 'IT')
      .replace('B', 'B');
  };

  const catalog: Record<string, { name: string; details: string; iq: number; cost: string; description: string }> = {
    'llama-3.3-70b-versatile': {
      name: 'Llama 3.3 70B',
      iq: 90,
      cost: 'Medium Burn',
      description: 'Balanced General IQ',
      details: 'Highly versatile, great for conversations and general tasks.'
    },
    'llama-3.1-8b-instant': {
      name: 'Llama 3.1 8B',
      iq: 75,
      cost: 'Low Burn',
      description: 'Ultra Speed (1000+ t/s)',
      details: 'Extremely fast querying and low resource usage.'
    },
    'gemma2-9b-it': {
      name: 'Gemma 2 9B IT',
      iq: 82,
      cost: 'Low-Medium Burn',
      description: 'Google\'s 9B instruction model',
      details: 'Good for general tutoring and precise instructions.'
    },
    'mixtral-8x7b-32768': {
      name: 'Mixtral 8x7B',
      iq: 85,
      cost: 'Medium Burn',
      description: 'Mixture of Experts model',
      details: 'High-quality responses and large context window.'
    },
    'deepseek-r1-distill-llama-70b': {
      name: 'DeepSeek R1 70B',
      iq: 95,
      cost: 'High Burn',
      description: 'Advanced reasoning model',
      details: 'Superb step-by-step reasoning distilled from DeepSeek R1.'
    }
  };

  return fetchedModels.map((m: any) => {
    const item = catalog[m.id];
    if (item) {
      return {
        id: m.id,
        name: item.name,
        iq: item.iq,
        cost: item.cost,
        description: item.description,
        details: item.details
      };
    }
    return {
      id: m.id,
      name: formatId(m.id),
      iq: m.id.includes('70b') ? 92 : 80,
      cost: m.id.includes('70b') ? 'High Burn' : 'Low Burn',
      description: 'Dynamic cloud model',
      details: `Available model owned by ${m.owned_by || 'groq'}.`
    };
  });
};

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
  const [localModelsList, setLocalModelsList] = useState<ModelProps[]>(RECOMMENDED_MODELS);
  
  // Cloud States
  const [useCloud, setUseCloud] = useState(false);
  const [cloudApiKey, setCloudApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [cloudModelId, setCloudModelId] = useState('llama-3.3-70b-versatile');
  
  const [groqModels, setGroqModels] = useState<GroqModelProps[]>(GROQ_MODELS);
  const [isSyncing, setIsSyncing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
    
    checkLocalModels();
    loadExistingConfig();
  }, []);

  const syncGroqModels = async (keyToUse: string, silent = false, skipDummyFallback = false) => {
    if (!keyToUse.trim()) return;
    setIsSyncing(true);
    try {
      const res = await ModelManager.fetchGroqLimitsAndModels(keyToUse.trim(), skipDummyFallback);
      setGroqModels(mapGroqModelsForSetup(res.models));
      
      if (res.models.length > 0 && !res.models.some((m: any) => m.id === cloudModelId)) {
        const defaultModel = res.models.some((m: any) => m.id === 'llama-3.3-70b-versatile')
          ? 'llama-3.3-70b-versatile'
          : res.models[0].id;
        setCloudModelId(defaultModel);
      }
      if (!silent) {
        Alert.alert("Success", "API key verified and models synced successfully!");
      }
    } catch (e) {
      console.warn("Sync error:", e);
      if (!silent) {
        Alert.alert("Connection Error", "Failed to verify API key. Please check the key and your internet connection.");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (useCloud && cloudApiKey.trim()) {
      syncGroqModels(cloudApiKey, true);
    }
  }, [useCloud]);

  // Constant background polling for rate limits (every 10 seconds)
  useEffect(() => {
    if (!useCloud || !cloudApiKey.trim()) return;

    const interval = setInterval(() => {
      syncGroqModels(cloudApiKey, true, true);
    }, 10000);

    return () => clearInterval(interval);
  }, [useCloud, cloudApiKey]);

  const loadExistingConfig = async () => {
    try {
      const config = await LocalServerManager.getConfig();
      setUseCloud(config.useCloud ?? false);
      setCloudApiKey(config.cloudApiKey ?? '');
      setCloudModelId(config.cloudModelId || 'llama-3.3-70b-versatile');

      // Load cached models
      const cachedModelsStr = await AsyncStorage.getItem('@padhai_groq_fetched_models');
      if (cachedModelsStr) {
        const cachedModels = JSON.parse(cachedModelsStr);
        setGroqModels(mapGroqModelsForSetup(cachedModels));
      }

      if (config.cloudApiKey) {
        syncGroqModels(config.cloudApiKey, true);
      }
    } catch (e) {
      console.warn("Failed to load existing config:", e);
    }
  };

  const checkLocalModels = async () => {
    try {
      const localFiles = await LocalServerManager.listLocalModels();
      const existing = [];
      const updatedList = [...RECOMMENDED_MODELS];

      // Update status of recommended models
      for (const model of RECOMMENDED_MODELS) {
        if (localFiles.includes(model.id)) {
          existing.push(model.id);
        }
      }

      // Add custom models to the list dynamically
      const recommendedIds = RECOMMENDED_MODELS.map(m => m.id);
      localFiles.forEach(file => {
        if (!recommendedIds.includes(file)) {
          updatedList.push({
            id: file,
            name: file.replace('.task', '').replace('.litertlm', ''),
            sizeGb: 0,
            purpose: 'Local Persistent Model',
            benchmarkScore: 85,
            description: 'Custom imported model found in Download/PadhAI',
            url: '',
            runtime: file.endsWith('.litertlm') ? 'litert' : 'mediapipe',
          });
          existing.push(file);
        }
      });

      setLocalModelsList(updatedList);
      setDownloadedModels(existing);

      if (existing.length > 0) {
        // Auto-select the first downloaded model if nothing is active
        if (!activeModelId) {
          setActiveModelId(existing[0]);
        }
      }
    } catch (e) {
      console.warn("Failed to check local models:", e);
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
             // Refresh files list to pick up public copies
             checkLocalModels();
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

  const handleScanStorage = async () => {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 30) {
          const hasPerm = await LocalServerManager.hasManageExternalStoragePermission();
          if (!hasPerm) {
            Alert.alert(
              'All Files Access Required',
              'To scan and read local AI model files from your Download folder, Padh.ai needs All Files Access permission. Please grant it on the next screen.',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Grant', 
                  onPress: async () => {
                    await LocalServerManager.requestManageExternalStoragePermission();
                  } 
                }
              ]
            );
            return;
          }
        } else {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            {
              title: 'Storage Access Required',
              message: 'Padh.ai needs access to your storage to scan for downloaded AI models.',
              buttonPositive: 'Allow',
              buttonNegative: 'Cancel',
            }
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permission Denied', 'Storage access is required to scan files.');
            return;
          }
        }
      }

      setIsStarting(true);
      await checkLocalModels();
      setIsStarting(false);

      const localFiles = await LocalServerManager.listLocalModels();
      if (localFiles.length > 0) {
        Alert.alert(
          'Scan Complete',
          `Found ${localFiles.length} model file(s) in storage. They are now listed below!`
        );
      } else {
        Alert.alert(
          'No Models Found',
          "No .task or .litertlm models found in the 'Download/PadhAI' storage directory.\n\nTip: Place your model files inside the 'Download/PadhAI' folder on your phone and try scanning again!"
        );
      }
    } catch (e: any) {
      setIsStarting(false);
      Alert.alert('Error', e.message || 'Failed to scan storage.');
    }
  };

  // New function: Import model file via DocumentPicker and copy to app private storage
  const handleImportModel = async () => {
    try {
      // Dynamically require RNFS to avoid crashes if the native module is missing
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const RNFS = require('react-native-fs');

      // Pick a single file (model) from the device
      const results: DocumentPickerResponse[] = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
      });

      const file = results?.[0];
      if (!file?.uri) return;

      const sourcePath = file.uri.replace('file://', '');
      const fileName = file.name || 'imported_model.task';
      const destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

      const exists = await RNFS.exists(sourcePath);
      if (!exists) {
        Alert.alert('File Not Found', 'The selected file could not be accessed.');
        return;
      }

      await RNFS.copyFile(sourcePath, destPath);

      const newModel: ModelProps = {
        id: fileName,
        name: fileName.replace('.task', '').replace('.litertlm', ''),
        sizeGb: 0,
        purpose: 'Local Persistent Model',
        benchmarkScore: 85,
        description: 'Custom imported model selected via file picker.',
        url: '',
        runtime: fileName.endsWith('.litertlm') ? 'litert' : 'mediapipe',
      };
      setLocalModelsList(prev => [...prev, newModel]);
      setDownloadedModels(prev => [...prev, fileName]);
      setActiveModelId(fileName);
      Alert.alert('Import Successful', `Model ${fileName} has been imported and set as active.`);
    } catch (e: any) {
      if (DocumentPicker.isCancel(e)) {
        // User cancelled the picker – silently ignore
        return;
      }
      // If RNFS is not linked, show a clear message
      if (e?.message?.includes('react-native-fs')) {
        Alert.alert(
          'Import Unavailable',
          'File import requires the native module "react-native-fs". Please ensure it is installed and linked.',
        );
        return;
      }
      Alert.alert('Import Error', e.message || 'Failed to import model file.');
    }
  };

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
    if (useCloud) {
      if (!cloudApiKey.trim()) {
        Alert.alert("API Key Required", "Please enter your Groq API key to continue, or switch to Local Engine.");
        return;
      }
      try {
        setIsStarting(true);
        const config = await LocalServerManager.getConfig();
        await LocalServerManager.saveConfig({
          ...config,
          useCloud: true,
          cloudApiKey: cloudApiKey.trim(),
          cloudModelId: cloudModelId,
          enabled: false, // Local model disabled when cloud is active
        });

        // Ensure local server is shut down to free system resources
        await LocalServerManager.stopServer();
        onFinish();
      } catch (e: any) {
        setIsStarting(false);
        Alert.alert("Error", e.message || "Failed to save configuration.");
      }
      return;
    }

    if (!activeModelId) {
      Alert.alert("Select a Model", "Please select a model to continue.");
      return;
    }
    
    try {
      setIsStarting(true);

      const finalModelId = activeModelId;
      const finalModelPath = await LocalServerManager.getModelPath(finalModelId);

      console.log("Igniting engine with model:", finalModelPath);
      
      const config = await LocalServerManager.getConfig();
      const selectedModel = localModelsList.find(m => m.id === finalModelId);
      
      const success = await LocalServerManager.startServer({
        ...config,
        enabled: true,
        useCloud: false,
        modelId: finalModelId,
        modelPath: finalModelPath,
        runtime: (selectedModel?.runtime as InferenceRuntime) || 'litert',
      });

      if (success) {
        console.log("Waiting for server to be fully ready...");
        let retries = 0;
        const maxRetries = 20;
        
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

  const renderCloudModelCard = (model: GroqModelProps) => {
    const isActive = cloudModelId === model.id;

    return (
      <TouchableOpacity 
        key={model.id} 
        style={[styles.modelCard, isActive && styles.modelCardActiveCloud]}
        onPress={() => setCloudModelId(model.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.modelName}>{model.name}</Text>
            <Text style={styles.modelPurpose}>{model.description}</Text>
          </View>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>IQ {model.iq}</Text>
          </View>
        </View>
        
        <Text style={styles.modelDesc}>{model.details}</Text>
        
        <View style={styles.cloudCardFooter}>
          <Text style={styles.costText}>{model.cost}</Text>
          <View style={[styles.selectIndicator, isActive && styles.selectIndicatorActive]}>
            <Text style={[styles.selectIndicatorText, isActive && styles.selectIndicatorTextActive]}>
              {isActive ? 'SELECTED' : 'SELECT'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={styles.header}>
            <Text style={styles.logoText}>padh[AI]</Text>
            <Text style={styles.title}>
              {useCloud ? 'Connect to Groq Cloud' : 'Ignite your local engine'}
            </Text>
            <Text style={styles.subtitle}>
              {useCloud 
                ? 'Experience ultra-fast cloud inference with larger models. An active internet connection is required.'
                : 'Pick a model to download. Padh.ai runs 100% locally for maximum privacy and zero latency.'
              }
            </Text>
          </View>

          {/* Segmented Control Selector */}
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tabButton, !useCloud && styles.tabButtonActive]}
              onPress={() => setUseCloud(false)}
            >
              <Server size={16} color={!useCloud ? '#FFF' : Theme.colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.tabText, !useCloud && styles.tabTextActive]}>Local Engine</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tabButton, useCloud && styles.tabButtonActive]}
              onPress={() => setUseCloud(true)}
            >
              <Globe size={16} color={useCloud ? '#FFF' : Theme.colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.tabText, useCloud && styles.tabTextActive]}>Cloud Engine</Text>
            </TouchableOpacity>
          </View>

          {useCloud ? (
            <View style={styles.cloudConfigContainer}>
              <Text style={styles.inputLabel}>Groq API Key</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="gsk_..."
                  placeholderTextColor={Theme.colors.textMuted}
                  value={cloudApiKey}
                  onChangeText={setCloudApiKey}
                  secureTextEntry={!showApiKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity 
                  style={styles.eyeBtn}
                  onPress={() => setShowApiKey(!showApiKey)}
                  activeOpacity={0.7}
                >
                  {showApiKey ? (
                    <EyeOff size={20} color={Theme.colors.textSecondary} />
                  ) : (
                    <Eye size={20} color={Theme.colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.helpLink}
                onPress={() => Linking.openURL('https://console.groq.com/keys')}
                activeOpacity={0.7}
              >
                <Text style={styles.helpLinkText}>Get your API Key from Groq Console</Text>
                <ExternalLink size={14} color={Theme.colors.secondary} style={{ marginLeft: 4 }} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.syncBtn, 
                  { marginTop: 14, backgroundColor: cloudApiKey.trim() ? Theme.colors.secondary : 'rgba(255,255,255,0.05)' }
                ]} 
                onPress={() => syncGroqModels(cloudApiKey)}
                disabled={isSyncing || !cloudApiKey.trim()}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={14} color={cloudApiKey.trim() ? "#000" : Theme.colors.textMuted} />
                    <Text style={[styles.syncBtnText, { color: cloudApiKey.trim() ? "#000" : Theme.colors.textMuted }]}>
                      Verify & Sync Models
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Select Cloud Model</Text>
              <View style={styles.modelList}>
                {groqModels.map(renderCloudModelCard)}
              </View>
            </View>
          ) : (
            <>
              <View style={styles.modelList}>
                {localModelsList.map(renderModelCard)}
              </View>

              {/* Scan Storage Folder */}
              <TouchableOpacity
                style={[styles.modelCard, { borderStyle: 'dashed', borderColor: Theme.colors.secondary + '60', flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18, marginTop: 8 }]}
                onPress={handleScanStorage}
                activeOpacity={0.7}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Theme.colors.secondary + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <FolderOpen size={20} color={Theme.colors.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modelName, { color: Theme.colors.secondary }]}>Scan Storage Folder</Text>
                  <Text style={styles.modelPurpose}>Scan 'Download/PadhAI/' directory for new model files</Text>
                </View>
              </TouchableOpacity>
              {/* Import Model from Device */}
              <TouchableOpacity
                style={[styles.modelCard, { borderStyle: 'dashed', borderColor: Theme.colors.secondary + '60', flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18, marginTop: 8 }]}
                onPress={handleImportModel}
                activeOpacity={0.7}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Theme.colors.secondary + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <FolderOpen size={20} color={Theme.colors.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modelName, { color: Theme.colors.secondary }]}>Import Model from Device</Text>
                  <Text style={styles.modelPurpose}>Select a model file from your device storage to copy into app private storage.</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.startBtn, ((!useCloud && !activeModelId) || isStarting) && styles.startBtnDisabled]}
            disabled={(!useCloud && !activeModelId) || isStarting}
            onPress={handleStartOnboarding}
          >
            {isStarting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#FFF" size="small" />
                <Text style={styles.startBtnText}>
                  STARTING...
                </Text>
              </View>
            ) : (
              <Text style={styles.startBtnText}>
                START ONBOARDING
              </Text>
            )}
          </TouchableOpacity>
          
          {onSkip && (
            <TouchableOpacity 
              style={[styles.skipBtn, { marginTop: 12 }]}
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
    marginTop: 10,
    marginBottom: 20,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '300',
    color: Theme.colors.primary,
    letterSpacing: 4,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Theme.colors.textMuted,
    lineHeight: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: Theme.colors.primary,
  },
  tabText: {
    color: Theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFF',
  },
  cloudConfigContainer: {
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.textSecondary,
    marginBottom: 8,
    fontFamily: Theme.fonts.bold,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    borderRadius: 14,
    paddingRight: 12,
  },
  textInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    color: Theme.colors.text,
    fontSize: 16,
  },
  eyeBtn: {
    padding: 8,
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  helpLinkText: {
    fontSize: 13,
    color: Theme.colors.secondary,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  modelList: {
    gap: 16,
  },
  modelCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  modelCardActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primary + '08',
  },
  modelCardActiveCloud: {
    borderColor: Theme.colors.secondary,
    backgroundColor: Theme.colors.secondary + '08',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  modelName: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 2,
  },
  modelPurpose: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.primary,
    textTransform: 'uppercase',
  },
  scoreBadge: {
    backgroundColor: Theme.colors.surfaceHigh,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFB000',
  },
  modelDesc: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  downloadBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  downloadBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  actionBtn: {
    paddingVertical: 12,
    borderRadius: 14,
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
    fontSize: 13,
  },
  selectBtnText: {
    color: Theme.colors.primary,
  },
  activeBtnText: {
    color: '#FFF',
  },
  downloadContainer: {
    marginTop: 2,
  },
  progressTrack: {
    height: 5,
    backgroundColor: Theme.colors.surfaceHigh,
    borderRadius: 2.5,
    overflow: 'hidden',
    marginBottom: 8,
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
    fontSize: 11,
    color: Theme.colors.textMuted,
    fontWeight: '600',
  },
  cloudCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  costText: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    fontWeight: '600',
  },
  selectIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  selectIndicatorActive: {
    backgroundColor: Theme.colors.secondary,
    borderColor: Theme.colors.secondary,
  },
  selectIndicatorText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.textSecondary,
  },
  selectIndicatorTextActive: {
    color: '#000',
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
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  startBtnDisabled: {
    backgroundColor: Theme.colors.surfaceHigh,
    shadowOpacity: 0,
  },
  startBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  skipBtnText: {
    color: Theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  syncBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnText: {
    fontWeight: '700',
    fontSize: 13,
    fontFamily: Theme.fonts.bold,
  },
});
