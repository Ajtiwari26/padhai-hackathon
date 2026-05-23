import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Switch, TextInput,
  LayoutAnimation, Linking, ActivityIndicator, PermissionsAndroid, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme/theme';
import { StudentProfileStore, StudentProfile } from '../../core/storage/StudentProfile';
import { LocalServerManager } from '../../core/api/LocalServerManager';
import { Cpu, Settings, User, Target, RefreshCw, Download, Server, Globe, Eye, EyeOff, ExternalLink, Info, FolderOpen } from 'lucide-react-native';
import { StatusBanner } from '../components/StatusBanner';
import { ModelManager } from '../../core/api/ModelManager';

// const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ModelVariant {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  description: string;
  quantization: string;
  recommended: boolean;
  status: 'not_downloaded' | 'downloaded' | 'downloading';
}

// Gemma 4 model variants — adapted from Nukky's ModelSettingsPage
const MODEL_VARIANTS: ModelVariant[] = [
  {
    id: 'gemma-4-E2B-it.litertlm',
    name: 'Gemma 4 E2B',
    size: '2.58 GB',
    sizeBytes: 2580000000,
    description: 'Lightweight variant. Best for devices with 4-6GB RAM.',
    quantization: 'E2B (2-bit)',
    recommended: false,
    status: 'not_downloaded',
  },
  {
    id: 'gemma-4-E4B-it.litertlm',
    name: 'Gemma 4 E4B',
    size: '3.65 GB',
    sizeBytes: 3650000000,
    description: 'Full quality variant. Recommended for devices with 8GB+ RAM.',
    quantization: 'E4B (4-bit)',
    recommended: true,
    status: 'not_downloaded',
  },
];

interface CloudModel {
  id: string;
  name: string;
  iq: number;
  speed: number;
  weight: number;
  dailyLimit: number;
  description: string;
}

const CLOUD_MODELS: CloudModel[] = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    iq: 90,
    speed: 90,
    weight: 4,
    dailyLimit: 100000,
    description: 'Highly versatile, balanced conversation & general IQ.',
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B',
    iq: 82,
    speed: 1000,
    weight: 1,
    dailyLimit: 200000,
    description: 'Ultra fast response (1000+ t/s) & low resource footprint.',
  },
  {
    id: 'gemma2-9b-it',
    name: 'Gemma 2 9B IT',
    iq: 85,
    speed: 350,
    weight: 2,
    dailyLimit: 100000,
    description: 'Google\'s highly capable 9B instruction-tuned model.',
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B',
    iq: 88,
    speed: 180,
    weight: 3,
    dailyLimit: 100000,
    description: 'Mixture of Experts model with large context.',
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 70B',
    iq: 95,
    speed: 30,
    weight: 5,
    dailyLimit: 100000,
    description: 'Advanced reasoning distilled from DeepSeek R1.',
  },
];

const GROQ_CATALOG: Record<string, { name: string; description: string; iq: number; speed: number; weight: number }> = {
  'llama-3.3-70b-versatile': {
    name: 'Llama 3.3 70B',
    description: 'Highly versatile, balanced conversation & general IQ.',
    iq: 90,
    speed: 90,
    weight: 4
  },
  'llama-3.1-8b-instant': {
    name: 'Llama 3.1 8B',
    description: 'Ultra fast response (1000+ t/s) & low resource footprint.',
    iq: 82,
    speed: 1000,
    weight: 1
  },
  'gemma2-9b-it': {
    name: 'Gemma 2 9B IT',
    description: 'Google\'s highly capable 9B instruction-tuned model.',
    iq: 85,
    speed: 350,
    weight: 2
  },
  'mixtral-8x7b-32768': {
    name: 'Mixtral 8x7B',
    description: 'Mixture of Experts model with large context.',
    iq: 88,
    speed: 180,
    weight: 3
  },
  'deepseek-r1-distill-llama-70b': {
    name: 'DeepSeek R1 70B',
    description: 'Advanced reasoning distilled from DeepSeek R1.',
    iq: 95,
    speed: 30,
    weight: 5
  }
};

const mapGroqModels = (fetchedModels: any[]): CloudModel[] => {
  if (!fetchedModels || fetchedModels.length === 0) return CLOUD_MODELS;
  
  const formatId = (id: string): string => {
    return id
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .replace('Distill', 'Distilled')
      .replace('It', 'IT')
      .replace('B', 'B');
  };

  return fetchedModels.map((m: any) => {
    const catalog = GROQ_CATALOG[m.id];
    if (catalog) {
      return {
        id: m.id,
        name: catalog.name,
        iq: catalog.iq,
        speed: catalog.speed,
        weight: catalog.weight,
        dailyLimit: 100000,
        description: catalog.description
      };
    }
    
    return {
      id: m.id,
      name: formatId(m.id),
      iq: m.id.includes('70b') ? 92 : (m.id.includes('8b') || m.id.includes('9b') ? 83 : 75),
      speed: m.id.includes('8b') ? 1000 : 150,
      weight: m.id.includes('70b') ? 4 : 2,
      dailyLimit: 100000,
      description: `Available model owned by ${m.owned_by || 'groq'}.`
    };
  });
};

interface Props {
  navigation: any;
}

export const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [models, setModels] = useState(MODEL_VARIANTS);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [extendedThinking, setExtendedThinking] = useState(false);
  const [maxOutputTokens, setMaxOutputTokens] = useState(512);
  const [contextBudget, setContextBudget] = useState(8192);
  const [gpuEnabled, setGpuEnabled] = useState(true);
  const [engineRunning, setEngineRunning] = useState(false);
  const [, setIsGenerating] = useState(false);

  // Cloud States
  const [useCloud, setUseCloud] = useState(false);
  const [cloudApiKey, setCloudApiKey] = useState('');
  const [cloudModelId, setCloudModelId] = useState('llama-3.3-70b-versatile');
  const [showApiKey, setShowApiKey] = useState(false);
  const [groqTokensUsed, setGroqTokensUsed] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('You are Padh.ai, a strict Socratic AI tutor. Do not give direct answers.');
  const [contextWindowSize, setContextWindowSize] = useState(4);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Dynamic Rate Limits & Models
  const [limitRequests, setLimitRequests] = useState(0);
  const [remainingRequests, setRemainingRequests] = useState(0);
  const [limitTokens, setLimitTokens] = useState(0);
  const [remainingTokens, setRemainingTokens] = useState(0);
  const [limitsLastUpdated, setLimitsLastUpdated] = useState<number | null>(null);
  const [groqModels, setGroqModels] = useState<CloudModel[]>(CLOUD_MODELS);
  const [isRefreshingLimits, setIsRefreshingLimits] = useState(false);

  const refreshModelsList = async () => {
    try {
      const localFiles = await LocalServerManager.listLocalModels();
      const updatedModels = MODEL_VARIANTS.map(variant => {
        const isDownloaded = localFiles.includes(variant.id);
        return {
          ...variant,
          status: isDownloaded ? ('downloaded' as const) : ('not_downloaded' as const),
        };
      });

      // Add custom models found in storage
      const recommendedIds = MODEL_VARIANTS.map(m => m.id);
      localFiles.forEach(file => {
        if (!recommendedIds.includes(file)) {
          updatedModels.push({
            id: file,
            name: file.replace('.task', '').replace('.litertlm', ''),
            size: 'Custom',
            sizeBytes: 0,
            description: 'Local persistent model',
            quantization: 'Custom',
            recommended: false,
            status: 'downloaded',
          });
        }
      });

      setModels(updatedModels);
      return updatedModels;
    } catch (e) {
      console.warn("Failed to list local models:", e);
      return MODEL_VARIANTS;
    }
  };

  const refreshGroqData = async (apiKeyToUse: string, skipDummyFallback = false, isPolling = false) => {
    if (!apiKeyToUse.trim()) return;
    setIsRefreshingLimits(true);
    try {
      const res = await ModelManager.fetchGroqLimitsAndModels(apiKeyToUse.trim(), skipDummyFallback);
      
      const mapped = mapGroqModels(res.models);
      setGroqModels(mapped);
      
      if (res.limits) {
        setLimitRequests(res.limits.limitRequests);
        setRemainingRequests(res.limits.remainingRequests);
        setLimitTokens(res.limits.limitTokens);
        setRemainingTokens(res.limits.remainingTokens);
        setLimitsLastUpdated(Date.now());
      }
      
      if (res.models.length > 0 && !res.models.some((m: any) => m.id === cloudModelId)) {
        const defaultModel = res.models.some((m: any) => m.id === 'llama-3.3-70b-versatile') 
          ? 'llama-3.3-70b-versatile'
          : res.models[0].id;
        setCloudModelId(defaultModel);
      }
    } catch (e: any) {
      if (!isPolling) {
        console.warn("Failed to fetch Groq dynamic data:", e);
      }
    } finally {
      setIsRefreshingLimits(false);
    }
  };

  useEffect(() => {
    if (configLoaded && useCloud && cloudApiKey.trim()) {
      refreshGroqData(cloudApiKey);
    }
  }, [useCloud]);

  // Constant background polling for rate limits (every 10 seconds)
  useEffect(() => {
    if (!configLoaded || !useCloud || !cloudApiKey.trim()) return;

    const interval = setInterval(() => {
      refreshGroqData(cloudApiKey, true, true);
    }, 10000);

    return () => clearInterval(interval);
  }, [configLoaded, useCloud, cloudApiKey]);

  useEffect(() => {
    StudentProfileStore.get().then(setProfile);
    
    const init = async () => {
      const updatedModels = await refreshModelsList();
      
      const config = await LocalServerManager.getConfig();
      if (config.modelId) {
        setActiveModel(config.modelId);
      }
      setMaxOutputTokens(config.maxOutputTokens || 512);
      setContextBudget(config.maxTokens || 8192);
      setExtendedThinking(config.extendedThinking || false);
      setGpuEnabled(config.useGpu !== undefined ? config.useGpu : true);

      // Cloud parameters
      setUseCloud(config.useCloud || false);
      setCloudApiKey(config.cloudApiKey || '');
      setCloudModelId(config.cloudModelId || 'llama-3.3-70b-versatile');
      setSystemPrompt(config.systemPrompt || 'You are Padh.ai, a strict Socratic AI tutor. Do not give direct answers.');
      setContextWindowSize(config.contextWindowSize || 4);

      // Fetch groq tokens and rate limits
      try {
        const rawTokens = await AsyncStorage.getItem('@padhai_groq_tokens_used');
        setGroqTokensUsed(rawTokens ? parseInt(rawTokens, 10) || 0 : 0);

        const limitReq = await AsyncStorage.getItem('@padhai_groq_limit_requests');
        const remainReq = await AsyncStorage.getItem('@padhai_groq_remaining_requests');
        const limitTok = await AsyncStorage.getItem('@padhai_groq_limit_tokens');
        const remainTok = await AsyncStorage.getItem('@padhai_groq_remaining_tokens');
        const lastUpdated = await AsyncStorage.getItem('@padhai_groq_limits_last_updated');

        if (limitReq) setLimitRequests(parseInt(limitReq, 10));
        if (remainReq) setRemainingRequests(parseInt(remainReq, 10));
        if (limitTok) setLimitTokens(parseInt(limitTok, 10));
        if (remainTok) setRemainingTokens(parseInt(remainTok, 10));
        if (lastUpdated) setLimitsLastUpdated(parseInt(lastUpdated, 10));
      } catch (e) {
        console.warn("Failed to load groq tokens and limits:", e);
      }

      // Load cached models
      try {
        const cachedModelsStr = await AsyncStorage.getItem('@padhai_groq_fetched_models');
        if (cachedModelsStr) {
          const cachedModels = JSON.parse(cachedModelsStr);
          setGroqModels(mapGroqModels(cachedModels));
        }
      } catch (e) {
        console.warn("Failed to load cached groq models:", e);
      }
      
      setEngineRunning(await LocalServerManager.isRunning());
      setModels(updatedModels);
      setConfigLoaded(true);
    };
    
    init();
    
    const interval = setInterval(async () => {
      setEngineRunning(await LocalServerManager.isRunning());
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Auto-save config when any local server config changes
  useEffect(() => {
    if (!configLoaded) return;

    const saveSettings = async () => {
      try {
        const config = await LocalServerManager.getConfig();
        const updatedConfig = {
          ...config,
          useCloud,
          cloudApiKey,
          cloudModelId,
          maxOutputTokens,
          maxTokens: contextBudget,
          extendedThinking,
          useGpu: gpuEnabled,
          systemPrompt,
          contextWindowSize,
        };
        await LocalServerManager.saveConfig(updatedConfig);
        console.log("[SettingsScreen] Config auto-saved successfully");
      } catch (e) {
        console.error("Failed to auto-save config:", e);
      }
    };

    saveSettings();
  }, [
    configLoaded,
    useCloud,
    cloudApiKey,
    cloudModelId,
    maxOutputTokens,
    contextBudget,
    extendedThinking,
    gpuEnabled,
    systemPrompt,
    contextWindowSize
  ]);

  // const TOKEN_PRESETS = [
  //   { label: 'Quick', value: 256, desc: '~100 words' },
  //   { label: 'Balanced', value: 512, desc: '~200 words' },
  //   { label: 'Detailed', value: 1024, desc: '~400 words' },
  //   { label: 'Maximum', value: 2048, desc: '~800 words' },
  // ];

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

      setIsGenerating(true);
      await refreshModelsList();
      setIsGenerating(false);

      const localFiles = await LocalServerManager.listLocalModels();
      if (localFiles.length > 0) {
        Alert.alert(
          'Scan Complete',
          `Found ${localFiles.length} model file(s) in storage. They are now available to use!`
        );
      } else {
        Alert.alert(
          'No Models Found',
          "No .task or .litertlm models found in the 'Download/PadhAI' storage directory.\n\nTip: Place your model files inside the 'Download/PadhAI' folder on your phone and try scanning again!"
        );
      }
    } catch (e: any) {
      setIsGenerating(false);
      Alert.alert('Error', e.message || 'Failed to scan storage.');
    }
  };

  const handleDownload = (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    Alert.alert(
      'Download Model',
      `Download ${model?.name} (${model?.size})?\n\nThis will use mobile data if not on Wi-Fi.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: async () => {
          try {
            // Simplified actual download hookup
            const url = modelId === 'gemma-4-E4B-it.litertlm' 
              ? 'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it.litertlm'
              : 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm';
            
            const nativeId = await LocalServerManager.startModelDownload(url, modelId);
            
            // Poll for completion (simplified)
            const interval = setInterval(async () => {
              const status = await LocalServerManager.getDownloadStatus(nativeId);
              if (status) {
                if (status.status === 8) { // Success
                  clearInterval(interval);
                  setModels(prev => prev.map(m =>
                    m.id === modelId ? { ...m, status: 'downloaded' as const } : m
                  ));
                  setDownloadProgress(prev => ({ ...prev, [modelId]: 100 }));
                } else if (status.status === 16) { // Failed
                  clearInterval(interval);
                  Alert.alert('Error', 'Download failed.');
                } else if (status.bytesTotal > 0) {
                  setDownloadProgress(prev => ({ ...prev, [modelId]: (status.bytesDownloaded / status.bytesTotal) * 100 }));
                }
              }
            }, 1000);
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to start download');
          }
        }},
      ]
    );
  };

  const handleLoadModel = async (modelId: string) => {
    try {
      setIsGenerating(true); // Reusing generating state for loading
      setActiveModel(modelId);
      
      // 1. Stop existing engine if running
      if (engineRunning) {
        await LocalServerManager.stopServer();
        setEngineRunning(false);
        await new Promise(resolve => setTimeout(() => resolve(null), 1000));
      }

      const config = await LocalServerManager.getConfig();
      const modelPath = await LocalServerManager.getModelPath(modelId);
      
      const success = await LocalServerManager.startServer({
        ...config,
        modelId: modelId,
        modelPath: modelPath,
        enabled: true,
        useGpu: gpuEnabled,
        maxTokens: contextBudget,
        maxOutputTokens: maxOutputTokens,
        extendedThinking: extendedThinking,
      });
      
      if (success) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setEngineRunning(true);
        Alert.alert('Engine Started', `${models.find(m => m.id === modelId)?.name} is now running.\n\nYou can start chatting with Padh.ai mentor.`);
      } else {
        throw new Error('Failed to start native engine.');
      }
    } catch(e: any) {
      Alert.alert('Startup Error', e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStopEngine = async () => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setEngineRunning(false); // Immediate UI feedback
      await LocalServerManager.stopServer();
      
      // Wait a bit and check again
      setTimeout(async () => {
        const stillRunning = await LocalServerManager.isRunning();
        if (stillRunning) {
          setEngineRunning(true);
        }
      }, 2000);
    } catch (e) {
      console.error("Stop error:", e);
      setEngineRunning(true); // Revert if hard error
    }
  };

  const handleRedoOnboarding = () => {
    Alert.alert(
      'Redo Profile',
      'This will restart the onboarding chat to update your profile. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Redo', style: 'destructive', onPress: async () => {
          await StudentProfileStore.save({ onboardingComplete: false });
          // Navigation to onboarding would go here
        }},
      ]
    );
  };

  const renderCloudModelCard = (model: CloudModel) => {
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
        
        <View style={styles.cloudCardFooter}>
          <View style={{ flexDirection: 'column' }}>
            <Text style={styles.costText}>Burn Rate: {model.weight}x</Text>
            <Text style={styles.speedText}>Speed: {model.speed} t/s</Text>
          </View>
          <View style={[styles.selectIndicator, isActive && styles.selectIndicatorActive]}>
            <Text style={[styles.selectIndicatorText, isActive && styles.selectIndicatorTextActive]}>
              {isActive ? 'SELECTED' : 'SELECT'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderUsageBarCard = () => {
    const tokenProgress = limitTokens > 0 ? Math.min(((limitTokens - remainingTokens) / limitTokens) * 100, 100) : 0;
    const requestProgress = limitRequests > 0 ? Math.min(((limitRequests - remainingRequests) / limitRequests) * 100, 100) : 0;
    
    const formattedLastUpdated = limitsLastUpdated 
      ? new Date(limitsLastUpdated).toLocaleTimeString() 
      : 'Never';

    return (
      <View style={[styles.settingCard, { marginTop: 16 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View>
            <Text style={styles.settingLabel}>Groq API Rate Limits</Text>
            <Text style={{ color: Theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>Last Synced: {formattedLastUpdated}</Text>
          </View>
          <TouchableOpacity 
            onPress={() => refreshGroqData(cloudApiKey)}
            disabled={isRefreshingLimits}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            {isRefreshingLimits ? (
              <ActivityIndicator size="small" color={Theme.colors.secondary} />
            ) : (
              <>
                <RefreshCw size={14} color={Theme.colors.secondary} />
                <Text style={{ color: Theme.colors.secondary, fontSize: 13, fontWeight: '700', fontFamily: Theme.fonts.bold }}>Refresh</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {limitTokens > 0 ? (
          <>
            {/* Tokens TPM progress */}
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.progText}>Tokens Per Minute (TPM)</Text>
                <Text style={styles.progText}>
                  {Math.max(0, limitTokens - remainingTokens).toLocaleString()} / {limitTokens.toLocaleString()}
                </Text>
              </View>
              <View style={styles.progBarBg}>
                <View style={[styles.progBarFill, { width: `${tokenProgress}%`, backgroundColor: Theme.colors.secondary }]} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                <Text style={[styles.progText, { fontSize: 10 }]}>Remaining: {remainingTokens.toLocaleString()} tokens</Text>
                <Text style={[styles.progText, { fontSize: 10 }]}>{Math.round(100 - tokenProgress)}% free</Text>
              </View>
            </View>

            {/* Requests RPM progress */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.progText}>Requests Per Day (RPD / RPM)</Text>
                <Text style={styles.progText}>
                  {Math.max(0, limitRequests - remainingRequests).toLocaleString()} / {limitRequests.toLocaleString()}
                </Text>
              </View>
              <View style={styles.progBarBg}>
                <View style={[styles.progBarFill, { width: `${requestProgress}%`, backgroundColor: Theme.colors.primary }]} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                <Text style={[styles.progText, { fontSize: 10 }]}>Remaining: {remainingRequests.toLocaleString()} requests</Text>
                <Text style={[styles.progText, { fontSize: 10 }]}>{Math.round(100 - requestProgress)}% free</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={[styles.progText, { textAlign: 'center', color: Theme.colors.textMuted }]}>
              No API limit data available. Enter your API key and tap "Refresh" to fetch real-time rate limits and supported models from Groq.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderTokenBudgetVisualizer = () => {
    const systemTokens = Math.round(systemPrompt.length / 4);
    const contextTokens = contextWindowSize * 200;
    const outputTokens = maxOutputTokens;
    const totalUsed = systemTokens + contextTokens + outputTokens;
    const remaining = Math.max(0, contextBudget - totalUsed);

    const total = Math.max(contextBudget, totalUsed);
    const systemPct = (systemTokens / total) * 100;
    const contextPct = (contextTokens / total) * 100;
    const outputPct = (outputTokens / total) * 100;
    const remainingPct = (remaining / total) * 100;

    return (
      <View style={styles.tokenViz}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={[styles.toggleDesc, { marginTop: 0 }]}>Interactive Token Budget Allocator</Text>
          <Text style={styles.tokenVizLabel}>{totalUsed} / {contextBudget} tokens</Text>
        </View>

        {showTooltip && (
          <View style={styles.tooltipCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Info size={14} color={Theme.colors.secondary} />
              <Text style={styles.tooltipTitle}>Token Allocation Breakdown</Text>
            </View>
            <View style={styles.tooltipRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.colorIndicator, { backgroundColor: Theme.colors.primary }]} />
                <Text style={styles.tooltipLabel}>System Prompt</Text>
              </View>
              <Text style={styles.tooltipValue}>{systemTokens} tokens</Text>
            </View>
            <View style={styles.tooltipRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.colorIndicator, { backgroundColor: Theme.colors.secondary }]} />
                <Text style={styles.tooltipLabel}>Context Memory</Text>
              </View>
              <Text style={styles.tooltipValue}>{contextTokens} tokens</Text>
            </View>
            <View style={styles.tooltipRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.colorIndicator, { backgroundColor: Theme.colors.success }]} />
                <Text style={styles.tooltipLabel}>Max Output</Text>
              </View>
              <Text style={styles.tooltipValue}>{outputTokens} tokens</Text>
            </View>
            <View style={[styles.tooltipRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.colorIndicator, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]} />
                <Text style={styles.tooltipLabel}>Remaining Free</Text>
              </View>
              <Text style={styles.tooltipValue}>{remaining} tokens</Text>
            </View>
          </View>
        )}

        <TouchableOpacity 
          style={styles.tokenBudgetBar} 
          onPress={() => setShowTooltip(!showTooltip)}
          activeOpacity={0.85}
        >
          {systemPct > 0 && <View style={[styles.tokenBudgetSegment, { width: `${systemPct}%`, backgroundColor: Theme.colors.primary }]} />}
          {contextPct > 0 && <View style={[styles.tokenBudgetSegment, { width: `${contextPct}%`, backgroundColor: Theme.colors.secondary }]} />}
          {outputPct > 0 && <View style={[styles.tokenBudgetSegment, { width: `${outputPct}%`, backgroundColor: Theme.colors.success }]} />}
          {remainingPct > 0 && <View style={[styles.tokenBudgetSegment, { width: `${remainingPct}%`, backgroundColor: 'rgba(255, 255, 255, 0.15)' }]} />}
        </TouchableOpacity>
        
        <Text style={styles.tapPromptText}>Tap the budget bar to reveal token allocations</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Settings</Text>

        {/* ─── ENGINE STATUS BANNER ─── */}
        <View style={styles.statusBannerWrapper}>
          <StatusBanner />
        </View>

        {/* ─── ENGINE MODE SWITCHER ─── */}
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
            onPress={async () => {
              setUseCloud(true);
              if (engineRunning) {
                await handleStopEngine();
              }
            }}
          >
            <Globe size={16} color={useCloud ? '#FFF' : Theme.colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={[styles.tabText, useCloud && styles.tabTextActive]}>Cloud Engine</Text>
          </TouchableOpacity>
        </View>

        {!useCloud ? (
          <>
            {/* ─── MODEL GALLERY ─── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Cpu size={20} color={Theme.colors.text} />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>AI Model</Text>
            </View>
            <Text style={styles.sectionSub}>Download and manage Gemma 4 weights</Text>

            {models.map(model => {
              const progress = downloadProgress[model.id] || 0;
              const isDownloaded = model.status === 'downloaded' || progress >= 100;
              const isDownloading = progress > 0 && progress < 100;
              const isActive = activeModel === model.id;

              return (
                <View key={model.id} style={[styles.modelCard, isActive && styles.modelCardActive]}>
                  <View style={styles.modelHeader}>
                    <View>
                      <View style={styles.modelNameRow}>
                        <Text style={styles.modelName}>{model.name}</Text>
                        {model.recommended && (
                          <View style={styles.recBadge}>
                            <Text style={styles.recBadgeText}>RECOMMENDED</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.modelDesc}>{model.description}</Text>
                    </View>
                  </View>

                  <View style={styles.modelMeta}>
                    <View style={styles.modelMetaItem}>
                      <Text style={styles.metaLabel}>Size</Text>
                      <Text style={styles.metaValue}>{model.size}</Text>
                    </View>
                    <View style={styles.modelMetaItem}>
                      <Text style={styles.metaLabel}>Quantization</Text>
                      <Text style={styles.metaValue}>{model.quantization}</Text>
                    </View>
                    <View style={styles.modelMetaItem}>
                      <Text style={styles.metaLabel}>Status</Text>
                      <Text style={[styles.metaValue, {
                        color: isActive ? Theme.colors.success
                          : isDownloaded ? Theme.colors.secondary
                          : Theme.colors.textMuted,
                      }]}>
                        {isActive ? '● Active' : isDownloaded ? '✓ Ready' : isDownloading ? `${Math.round(progress)}%` : 'Not Downloaded'}
                      </Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  {isDownloading && (
                    <View style={styles.downloadProgress}>
                      <View style={styles.progBarBg}>
                        <View style={[styles.progBarFill, { width: `${progress}%` }]} />
                      </View>
                      <Text style={styles.progText}>{Math.round(progress)}% • {model.size}</Text>
                    </View>
                  )}

                  {/* Actions */}
                  <View style={styles.modelActions}>
                    {!isDownloaded && !isDownloading && (
                      <TouchableOpacity
                        style={styles.downloadBtn}
                        onPress={() => handleDownload(model.id)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Download size={16} color="#FFF" />
                          <Text style={styles.downloadBtnText}>Download</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    {isDownloaded && !isActive && (
                      <TouchableOpacity
                        style={styles.loadBtn}
                        onPress={() => handleLoadModel(model.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.loadBtnText}>Start Engine</Text>
                      </TouchableOpacity>
                    )}
                    {isActive && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={[styles.activeBadge, { flex: 1, backgroundColor: engineRunning ? Theme.colors.successBg : Theme.colors.surfaceHigh }]}>
                          <Text style={[styles.activeBadgeText, { color: engineRunning ? Theme.colors.success : Theme.colors.textMuted }]}>
                            {engineRunning ? '✓ Engine Running' : '⏸ Engine Sleeping'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.loadBtn, { flex: 1, backgroundColor: engineRunning ? 'rgba(239, 68, 68, 0.1)' : Theme.colors.primary + '15', borderColor: engineRunning ? 'rgba(239, 68, 68, 0.3)' : Theme.colors.primary + '30' }]}
                          onPress={engineRunning ? handleStopEngine : () => handleLoadModel(model.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.loadBtnText, { color: engineRunning ? '#EF4444' : Theme.colors.primary }]}>
                            {engineRunning ? 'Stop Engine' : 'Wake Engine'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {/* Scan Storage Folder Card */}
            <TouchableOpacity
              style={[styles.modelCard, { borderStyle: 'dashed', borderColor: Theme.colors.secondary + '60', flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18 }]}
              onPress={handleScanStorage}
              activeOpacity={0.7}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Theme.colors.secondary + '18', alignItems: 'center', justifyContent: 'center' }}>
                <FolderOpen size={20} color={Theme.colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modelName, { color: Theme.colors.secondary }]}>Scan Storage Folder</Text>
                <Text style={styles.modelDesc}>Scan 'Download/PadhAI/' directory for new model files</Text>
              </View>
            </TouchableOpacity>

            {/* ─── LOCAL INFERENCE SETTINGS ─── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, marginTop: 24 }}>
              <Settings size={20} color={Theme.colors.text} />
              <Text style={[styles.sectionTitle, { marginBottom: 0, marginTop: 0 }]}>Local Settings</Text>
            </View>
            <Text style={styles.sectionSub}>Optimize local LLM behavior</Text>

            {/* GPU Toggle */}
            <View style={styles.toggleSetting}>
              <View>
                <Text style={styles.toggleLabel}>GPU Acceleration</Text>
                <Text style={styles.toggleDesc}>Uses device GPU for faster inference</Text>
              </View>
              <Switch
                value={gpuEnabled}
                onValueChange={setGpuEnabled}
                trackColor={{ false: Theme.colors.surfaceHigh, true: Theme.colors.primary + '60' }}
                thumbColor={gpuEnabled ? Theme.colors.primary : Theme.colors.textMuted}
              />
            </View>

            {/* Reset Engine Cache */}
            <View style={styles.toggleSetting}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Reset Engine Cache</Text>
                <Text style={styles.toggleDesc}>Clears temporary model cache. Use if the engine fails to start.</Text>
              </View>
              <TouchableOpacity 
                style={[styles.loadBtn, { width: 100, height: 36, marginTop: 0 }]}
                onPress={async () => {
                  const success = await LocalServerManager.resetCache();
                  if (success) Alert.alert('Success', 'Engine cache cleared. Try starting the engine again.');
                }}
              >
                <Text style={styles.loadBtnText}>Reset</Text>
              </TouchableOpacity>
            </View>

            {/* Extended Thinking */}
            <View style={styles.toggleSetting}>
              <View>
                <Text style={styles.toggleLabel}>Extended Thinking</Text>
                <Text style={styles.toggleDesc}>Enables step-by-step reasoning (slower)</Text>
              </View>
              <Switch
                value={extendedThinking}
                onValueChange={setExtendedThinking}
                trackColor={{ false: Theme.colors.secondary + '60' }}
                thumbColor={extendedThinking ? Theme.colors.secondary : Theme.colors.textMuted}
              />
            </View>
          </>
        ) : (
          <>
            {/* ─── CLOUD INFERENCE SETTINGS ─── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Globe size={20} color={Theme.colors.text} />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Cloud Settings</Text>
            </View>
            <Text style={styles.sectionSub}>Configure Groq API settings</Text>

            {/* API Key settings */}
            <View style={styles.settingCard}>
              <Text style={styles.inputLabel}>Groq API Key</Text>
              <View style={styles.apiKeyInputContainer}>
                <TextInput
                  style={styles.apiKeyTextInput}
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
                onPress={() => refreshGroqData(cloudApiKey)}
                disabled={isRefreshingLimits || !cloudApiKey.trim()}
              >
                {isRefreshingLimits ? (
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
            </View>

            {/* Model Benchmark Selector */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, marginTop: 12 }}>
              <Cpu size={20} color={Theme.colors.text} />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Select Cloud Model</Text>
            </View>
            <Text style={styles.sectionSub}>Choose model based on IQ rating and token burn</Text>

            <View style={styles.modelList}>
              {groqModels.map(renderCloudModelCard)}
            </View>

            {/* Groq usage progression bar */}
            {renderUsageBarCard()}
          </>
        )}

        {/* ─── GENERAL INFERENCE PARAMETERS ─── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, marginTop: 24 }}>
          <Settings size={20} color={Theme.colors.text} />
          <Text style={[styles.sectionTitle, { marginBottom: 0, marginTop: 0 }]}>Inference Parameters</Text>
        </View>
        <Text style={styles.sectionSub}>Adjust system prompts, context limits, and token budgets</Text>

        {/* System Prompt */}
        <View style={styles.settingCard}>
          <Text style={[styles.settingLabel, { marginBottom: 8 }]}>System Prompt</Text>
          <TextInput
            style={styles.systemPromptInput}
            value={systemPrompt}
            onChangeText={setSystemPrompt}
            placeholder="System prompt..."
            placeholderTextColor={Theme.colors.textMuted}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.toggleDesc}>
            Dictates AI mentor's persona and Socratic constraints.
          </Text>
        </View>

        {/* Context Window Size */}
        <View style={styles.settingCard}>
          <View style={styles.tokenInputRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Context Window Size</Text>
              <Text style={styles.toggleDesc}>
                Number of previous conversation turns included as context.
              </Text>
            </View>
            <TextInput
              style={styles.tokenTextInput}
              value={contextWindowSize.toString()}
              onChangeText={(v) => {
                const n = parseInt(v, 10);
                if (!isNaN(n)) setContextWindowSize(n);
                else if (v === '') setContextWindowSize(0);
              }}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
        </View>

        {/* Context Budget */}
        <View style={styles.settingCard}>
          <View style={styles.tokenInputRow}>
            <Text style={styles.settingLabel}>Context Budget (Total Tokens)</Text>
            <TextInput
              style={styles.tokenTextInput}
              value={contextBudget.toString()}
              onChangeText={(v) => {
                const n = parseInt(v, 10);
                if (!isNaN(n)) setContextBudget(n);
                else if (v === '') setContextBudget(0);
              }}
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>
          <Text style={styles.toggleDesc}>
            Maximum tokens kept in memory. Includes system prompt, history, and generated output.
          </Text>
        </View>

        {/* Token Budget / Max Output Tokens */}
        <View style={styles.settingCard}>
          <View style={styles.tokenInputRow}>
            <Text style={styles.settingLabel}>Max Output Tokens</Text>
            <TextInput
              style={styles.tokenTextInput}
              value={maxOutputTokens.toString()}
              onChangeText={(v) => {
                const n = parseInt(v, 10);
                if (!isNaN(n)) setMaxOutputTokens(n);
                else if (v === '') setMaxOutputTokens(0);
              }}
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>
          <View style={styles.tokenPresets}>
            {[256, 512, 1024, 2048].map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.presetBtn, maxOutputTokens === t && styles.presetBtnActive]}
                onPress={() => setMaxOutputTokens(t)}
              >
                <Text style={[styles.presetText, maxOutputTokens === t && styles.presetTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Interactive Token Budget Visualizer Card */}
          {renderTokenBudgetVisualizer()}
        </View>

        {/* ─── PROFILE ─── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, marginTop: 24 }}>
          <User size={20} color={Theme.colors.text} />
          <Text style={[styles.sectionTitle, { marginBottom: 0, marginTop: 0 }]}>Student Profile</Text>
        </View>

        {profile && (
          <View style={styles.profileCard}>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Name</Text>
              <Text style={styles.profileValue}>{profile.name || '—'}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Level</Text>
              <Text style={styles.profileValue}>{profile.educationLevel || '—'}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Academic Goal</Text>
              <Text style={styles.profileValue}>{profile.academicGoal || 'None'}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Subjects</Text>
              <Text style={styles.profileValue}>{profile.subjects?.join(', ') || '—'}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Daily Goal</Text>
              <Text style={styles.profileValue}>{profile.dailyHours}h</Text>
            </View>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.redoBtn, { backgroundColor: Theme.colors.primary + '10', marginBottom: 12 }]} 
          onPress={() => navigation.navigate('CareerPlanner')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Target size={18} color={Theme.colors.primary} />
            <Text style={[styles.redoBtnText, { color: Theme.colors.primary }]}>Career & Goal Planner</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.redoBtn} onPress={handleRedoOnboarding}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={18} color={Theme.colors.textSecondary} />
            <Text style={styles.redoBtnText}>Redo Onboarding</Text>
          </View>
        </TouchableOpacity>

        {/* ─── ABOUT ─── */}
        <View style={styles.aboutSection}>
          <Text style={styles.aboutTitle}>padh[AI]</Text>
          <Text style={styles.aboutVersion}>v0.1.0 • Powered by Gemma 4</Text>
          <Text style={styles.aboutDesc}>Local-first, on-device AI tutor. Your data stays on your device.</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scroll: {
    padding: 20,
    paddingTop: 16,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Theme.colors.text,
    fontFamily: Theme.fonts.bold,
    letterSpacing: -1,
    marginBottom: 24,
  },
  statusBannerWrapper: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Theme.colors.text,
    fontFamily: Theme.fonts.bold,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    marginBottom: 20,
  },

  // Model Card
  modelCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  modelCardActive: {
    borderColor: Theme.colors.primary + '50',
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
  },
  modelHeader: {},
  modelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  modelName: {
    fontSize: 18,
    fontWeight: '800',
    color: Theme.colors.text,
    fontFamily: Theme.fonts.bold,
  },
  recBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  recBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Theme.colors.success,
    fontFamily: Theme.fonts.bold,
    letterSpacing: 0.5,
  },
  modelDesc: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    lineHeight: 20,
    marginBottom: 20,
  },
  modelMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.glassBorder,
  },
  modelMetaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.text,
    fontFamily: Theme.fonts.bold,
  },

  // Download Progress
  downloadProgress: {
    marginBottom: 20,
  },
  progBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progBarFill: {
    height: '100%',
    backgroundColor: Theme.colors.primary,
    borderRadius: 3,
  },
  progText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.medium,
  },

  // Actions
  modelActions: {
    marginTop: 4,
  },
  downloadBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  downloadBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: Theme.fonts.bold,
  },
  loadBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.primary + '40',
    backgroundColor: Theme.colors.primary + '10',
  },
  loadBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: Theme.colors.primary,
    fontFamily: Theme.fonts.bold,
  },
  activeBadge: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  activeBadgeText: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: Theme.fonts.bold,
  },

  // Inference Settings
  settingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.text,
    fontFamily: Theme.fonts.bold,
  },
  tokenInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tokenTextInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: Theme.colors.primary,
    fontWeight: '800',
    fontSize: 18,
    minWidth: 90,
    textAlign: 'right',
    fontFamily: Theme.fonts.bold,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  tokenPresets: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  presetBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  presetBtnActive: {
    backgroundColor: Theme.colors.primary + '15',
    borderColor: Theme.colors.primary + '50',
  },
  presetText: {
    color: Theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Theme.fonts.bold,
  },
  presetTextActive: {
    color: Theme.colors.primary,
  },
  tokenViz: {
    marginTop: 4,
  },
  tokenVizBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  tokenVizFill: {
    height: '100%',
    backgroundColor: Theme.colors.primary,
    borderRadius: 3,
  },
  tokenVizLabel: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.medium,
    textAlign: 'right',
  },

  // Toggle Settings
  toggleSetting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.text,
    fontFamily: Theme.fonts.bold,
  },
  toggleDesc: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.medium,
    marginTop: 4,
    maxWidth: 240,
    lineHeight: 18,
  },

  // Profile
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.glassBorder,
  },
  profileLabel: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.medium,
  },
  profileValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.text,
    fontFamily: Theme.fonts.bold,
  },
  redoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  redoBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.bold,
  },

  // About
  aboutSection: {
    marginTop: 32,
    alignItems: 'center',
  },
  aboutTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Theme.colors.text,
    fontFamily: Theme.fonts.bold,
    letterSpacing: 2,
  },
  aboutVersion: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.bold,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  aboutDesc: {
    fontSize: 13,
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.medium,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },

  // Tab Container
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
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
    backgroundColor: Theme.colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.bold,
  },
  tabTextActive: {
    color: '#FFF',
  },

  // API Key styles
  apiKeyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    borderRadius: 14,
    paddingRight: 12,
    marginTop: 8,
  },
  apiKeyTextInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    color: Theme.colors.text,
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.text,
    fontFamily: Theme.fonts.bold,
  },
  eyeBtn: {
    padding: 8,
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  helpLinkText: {
    fontSize: 13,
    color: Theme.colors.secondary,
    fontFamily: Theme.fonts.bold,
    fontWeight: '600',
  },

  // Model Grid
  modelList: {
    gap: 16,
    marginBottom: 16,
  },
  modelCardActiveCloud: {
    borderColor: Theme.colors.secondary + '50',
    backgroundColor: 'rgba(45, 212, 191, 0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  modelPurpose: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.secondary,
    textTransform: 'uppercase',
    fontFamily: Theme.fonts.bold,
    marginTop: 2,
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
    fontFamily: Theme.fonts.bold,
  },
  cloudCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.glassBorder,
  },
  costText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.bold,
    fontWeight: '600',
  },
  speedText: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.medium,
    marginTop: 2,
  },
  selectIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  selectIndicatorActive: {
    backgroundColor: Theme.colors.secondary,
    borderColor: Theme.colors.secondary,
  },
  selectIndicatorText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.bold,
  },
  selectIndicatorTextActive: {
    color: '#000',
  },

  // Token Budget Bar
  tokenBudgetBar: {
    flexDirection: 'row',
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 12,
  },
  tokenBudgetSegment: {
    height: '100%',
  },
  tapPromptText: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.medium,
    marginTop: 6,
    textAlign: 'center',
  },

  // System prompt input
  systemPromptInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    textAlignVertical: 'top',
    minHeight: 80,
  },

  // Tooltip Popover Card
  tooltipCard: {
    backgroundColor: Theme.colors.surfaceHigh,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorderLight,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  tooltipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.text,
    fontFamily: Theme.fonts.bold,
  },
  tooltipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.glassBorder,
  },
  colorIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tooltipLabel: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.medium,
  },
  tooltipValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.text,
    fontFamily: Theme.fonts.bold,
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
