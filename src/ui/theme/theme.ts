// Padh.ai — Complete Design System
// Midnight Indigo + Teal Glassmorphism

export const Theme = {
  colors: {
    // Core palette
    primary: '#6366F1',         // Indigo 500
    primaryLight: '#818CF8',    // Indigo 400
    primaryDark: '#4338CA',     // Indigo 700
    secondary: '#2DD4BF',       // Teal 400
    secondaryLight: '#5EEAD4',  // Teal 300
    secondaryDark: '#0D9488',   // Teal 600
    accent: '#F59E0B',          // Amber for warnings/highlights
    border: 'rgba(255, 255, 255, 0.12)',

    // Surfaces
    background: '#0B1326',      // Midnight
    surface: '#111B33',
    surfaceHigh: '#1A2540',
    surfaceCard: '#151F38',
    surfaceMuted: '#0F1829',

    // Text
    text: '#E8EDFB',
    textSecondary: '#A5B3D4',
    textMuted: '#6B7A9E',
    textOnPrimary: '#FFFFFF',
    onSurface: '#E8EDFB',
    onSurfaceVariant: '#A5B3D4',

    // Surface Container
    surfaceContainer: '#111B33',

    // Glass
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    glassBackground: 'rgba(255, 255, 255, 0.04)',
    glassBorderLight: 'rgba(255, 255, 255, 0.12)',

    // Status
    success: '#10B981',
    successBg: 'rgba(16, 185, 129, 0.12)',
    warning: '#F59E0B',
    warningBg: 'rgba(245, 158, 11, 0.12)',
    error: '#EF4444',
    errorBg: 'rgba(239, 68, 68, 0.12)',
    info: '#3B82F6',

    // Confidence indicators (for knowledge graph)
    confidenceHigh: '#10B981',    // Green > 80%
    confidenceMid: '#F59E0B',     // Yellow 40-80%
    confidenceLow: '#EF4444',     // Red < 40%
    confidenceNone: '#374151',    // Not started

    // Gradients (defined as arrays for LinearGradient)
    gradientPrimary: ['#6366F1', '#8B5CF6'],
    gradientSecondary: ['#2DD4BF', '#06B6D4'],
    gradientSurface: ['#111B33', '#0B1326'],
    gradientCard: ['rgba(99, 102, 241, 0.08)', 'rgba(45, 212, 191, 0.05)'],
  },

  fonts: {
    regular: 'Lexend-Regular',
    medium: 'Lexend-Medium',
    semiBold: 'Lexend-SemiBold',
    bold: 'Lexend-Bold',
    light: 'Lexend-Light',
  },

  roundness: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    full: 999,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#6366F1',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
    glow: {
      shadowColor: '#2DD4BF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
  },

  typography: {
    h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
    h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
    h3: { fontSize: 18, fontWeight: '600' as const, letterSpacing: -0.2 },
    body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
    bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: '500' as const },
    label: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 1 },
    button: { fontSize: 15, fontWeight: '700' as const, letterSpacing: 0.3 },
  },
};

// Confidence helpers
export const getConfidenceColor = (score: number): string => {
  if (score >= 80) return Theme.colors.confidenceHigh;
  if (score >= 40) return Theme.colors.confidenceMid;
  if (score > 0) return Theme.colors.confidenceLow;
  return Theme.colors.confidenceNone;
};

export const getConfidenceLabel = (score: number): string => {
  if (score >= 80) return 'Clear';
  if (score >= 40) return 'In Progress';
  if (score > 0) return 'Needs Work';
  return 'Not Started';
};
