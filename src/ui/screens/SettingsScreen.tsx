import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Switch, TextInput,
  LayoutAnimation
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme/theme';
import { StudentProfileStore, StudentProfile } from '../../core/storage/StudentProfile';
import { LocalServerManager } from '../../core/api/LocalServerManager';
import { Cpu, Settings, User, Target, RefreshCw, Download } from 'lucide-react-native';
import { StatusBanner } from '../components/StatusBanner';

// const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  navigation: any;
}

// LayoutAnimation experimental is no-op in New Architecture, avoiding warning
// if (
//   Platform.OS === 'android' &&
//   UIManager.setLayoutAnimationEnabledExperimental
// ) {
//   UIManager.setLayoutAnimationEnabledExperimental(true);
// }

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

  useEffect(() => {
    StudentProfileStore.get().then(setProfile);
    
    const init = async () => {
      const updatedModels = [...MODEL_VARIANTS];
      for (let i = 0; i < updatedModels.length; i++) {
        const exists = await LocalServerManager.checkModelExists(updatedModels[i].id);
        if (exists) {
          updatedModels[i].status = 'downloaded';
        }
      }
      
      const config = await LocalServerManager.getConfig();
      if (config.modelId) {
        setActiveModel(config.modelId);
        setMaxOutputTokens(config.maxOutputTokens || 512);
        setContextBudget(config.maxTokens || 8192);
        setExtendedThinking(config.extendedThinking || false);
      }
      
      setEngineRunning(await LocalServerManager.isRunning());
      setModels(updatedModels);
    };
    
    init();
    
    const interval = setInterval(async () => {
      setEngineRunning(await LocalServerManager.isRunning());
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // const TOKEN_PRESETS = [
  //   { label: 'Quick', value: 256, desc: '~100 words' },
  //   { label: 'Balanced', value: 512, desc: '~200 words' },
  //   { label: 'Detailed', value: 1024, desc: '~400 words' },
  //   { label: 'Maximum', value: 2048, desc: '~800 words' },
  // ];

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Settings</Text>

        {/* ─── ENGINE STATUS BANNER ─── */}
        <View style={styles.statusBannerWrapper}>
          <StatusBanner />
        </View>

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

        {/* ─── INFERENCE SETTINGS ─── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, marginTop: 24 }}>
          <Settings size={20} color={Theme.colors.text} />
          <Text style={[styles.sectionTitle, { marginBottom: 0, marginTop: 0 }]}>Inference Settings</Text>
        </View>
        <Text style={styles.sectionSub}>Optimize local LLM behavior</Text>

        {/* Context Budget */}
        <View style={styles.settingCard}>
          <View style={styles.tokenInputRow}>
            <Text style={styles.settingLabel}>Context Budget (Total Tokens)</Text>
            <TextInput
              style={styles.tokenTextInput}
              value={contextBudget.toString()}
              onChangeText={(v) => {
                const n = parseInt(v);
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

        {/* Token Budget */}
        <View style={styles.settingCard}>
          <View style={styles.tokenInputRow}>
            <Text style={styles.settingLabel}>Max Output Tokens</Text>
            <TextInput
              style={styles.tokenTextInput}
              value={maxOutputTokens.toString()}
              onChangeText={(v) => {
                const n = parseInt(v);
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

          <View style={styles.tokenViz}>
            <View style={styles.tokenVizBarBg}>
              <View style={[styles.tokenVizFill, { width: `${Math.min((maxOutputTokens / contextBudget) * 100, 100)}%` }]} />
            </View>
            <Text style={styles.tokenVizLabel}>{maxOutputTokens} / {contextBudget} tokens</Text>
          </View>
        </View>

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
            trackColor={{ false: Theme.colors.surfaceHigh, true: Theme.colors.secondary + '60' }}
            thumbColor={extendedThinking ? Theme.colors.secondary : Theme.colors.textMuted}
          />
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
});
