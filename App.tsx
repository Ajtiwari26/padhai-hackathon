import React, { useState, useEffect } from 'react';
import { StatusBar, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Home, MessageSquare, BookOpen, PenTool, Settings, LayoutDashboard, MessageSquareQuote, BookOpenCheck, Target, UserCircle } from 'lucide-react-native';

import { Theme } from './src/ui/theme/theme';
import { StudentProfileStore } from './src/core/storage/StudentProfile';
import { LocalServerManager } from './src/core/api/LocalServerManager';
import { ResourcePlanner } from './src/core/planner/ResourcePlanner';

// Screens
import { SplashScreen } from './src/ui/screens/SplashScreen';
import { ModelSetupScreen } from './src/ui/screens/ModelSetupScreen';
import { OnboardingChat } from './src/ui/screens/OnboardingChat';
import { CareerPlannerScreen } from './src/ui/screens/CareerPlannerScreen';
import { HomeScreen } from './src/ui/screens/HomeScreen';
import { MentorChat } from './src/ui/screens/MentorChat';
import { LearningsLibrary } from './src/ui/screens/LearningsLibrary';
import { KnowledgeGraph } from './src/ui/screens/KnowledgeGraph';
import { TestsHub } from './src/ui/screens/TestsHub';
import { SettingsScreen } from './src/ui/screens/SettingsScreen';
import { ExamScreen } from './src/ui/screens/ExamScreen';
import { ScoreCard } from './src/ui/screens/ScoreCard';
import { QuestionDoubtSolver } from './src/ui/screens/QuestionDoubtSolver';
import { ChapterDetail } from './src/ui/screens/ChapterDetail';
import { TaskSchedulerScreen } from './src/ui/screens/TaskSchedulerScreen';
import { CurriculumCreator } from './src/ui/screens/CurriculumCreator';
import { CurriculumReview } from './src/ui/screens/CurriculumReview';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Navigation theme
const PadhTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: Theme.colors.primary,
    background: Theme.colors.background,
    card: Theme.colors.surface,
    text: Theme.colors.text,
    border: Theme.colors.glassBorder,
  },
};

// Tab icons mapping
const TAB_ICONS: Record<string, any> = {
  Home: LayoutDashboard,
  Chat: MessageSquareQuote,
  Learnings: BookOpenCheck,
  Tests: Target,
  Profile: UserCircle,
};

// Wrapper for MentorChat in tab context
const MentorChatTab = ({ navigation }: any) => (
  <MentorChat navigation={navigation} route={{ params: { topic: 'General' }}} />
);

// Bottom Tab Navigator
const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarIcon: ({ focused, color }) => {
        const IconComponent = TAB_ICONS[route.name] || MessageSquare;
        return (
          <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive]}>
            <IconComponent size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
          </View>
        );
      },
      tabBarActiveTintColor: Theme.colors.secondary,
      tabBarInactiveTintColor: Theme.colors.textMuted,
      tabBarStyle: {
        backgroundColor: Theme.colors.surface,
        borderTopColor: Theme.colors.glassBorder,
        height: 65,
        paddingBottom: 10,
        paddingTop: 10,
        elevation: 10,
        borderTopWidth: 1,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '600' as const,
      },
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Chat" component={MentorChatTab} />
    <Tab.Screen name="Learnings" component={LearningsLibrary} />
    <Tab.Screen name="Tests" component={TestsHub} />
    <Tab.Screen name="Profile" component={SettingsScreen} />
  </Tab.Navigator>
);

const App = () => {
  const [appState, setAppState] = useState<'splash' | 'modelSetup' | 'onboarding' | 'main'>('splash');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // Start the background task scheduler
      ResourcePlanner.start();
      console.log('[App] ResourcePlanner scheduler started');

      // Initialize native service in background without blocking the UI boot
      LocalServerManager.initialize().catch(e => 
        console.warn('[App] Engine init deferred or failed:', e)
      );
      
      setIsLoading(false);
    };
    init();
    
    // Cleanup on unmount
    return () => {
      ResourcePlanner.stop();
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} />
        <ActivityIndicator color={Theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} translucent />
      
      {appState === 'splash' && (
        <SplashScreen
          onFinish={async () => {
            const isOnboarded = await StudentProfileStore.isOnboarded();
            if (isOnboarded) {
              setAppState('main');
            } else {
              setAppState('modelSetup');
            }
          }}
        />
      )}

      {appState === 'modelSetup' && (
        <ModelSetupScreen 
          onFinish={() => setAppState('onboarding')} 
          onSkip={() => setAppState('onboarding')}
        />
      )}

      {appState === 'onboarding' && (
        <OnboardingChat 
          onComplete={() => setAppState('main')} 
          onSkip={() => setAppState('main')}
        />
      )}

      {appState === 'main' && (
        <NavigationContainer theme={PadhTheme}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: Theme.colors.background },
            }}
          >
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="ChapterDetail" component={ChapterDetail} />
            <Stack.Screen name="MentorChat" component={MentorChat} />
            <Stack.Screen name="CareerPlanner" component={CareerPlannerScreen} />
            <Stack.Screen name="ExamScreen" component={ExamScreen} />
            <Stack.Screen name="ScoreCard" component={ScoreCard} />
            <Stack.Screen name="QuestionDoubtSolver" component={QuestionDoubtSolver} />
            <Stack.Screen name="TaskScheduler" component={TaskSchedulerScreen} />
            <Stack.Screen name="Analytics" component={KnowledgeGraph} />
            <Stack.Screen name="Saved" component={KnowledgeGraph} />
            <Stack.Screen name="CurriculumCreator" component={CurriculumCreator} />
            <Stack.Screen name="CurriculumReview" component={CurriculumReview} />
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTabIconContainer: {
    backgroundColor: 'rgba(45, 212, 191, 0.15)',
    padding: 8,
    borderRadius: 16,
    marginBottom: 4,
  },
});

const tabStyles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  iconWrapActive: {
    backgroundColor: Theme.colors.primary + '18',
  },
  iconText: {
    fontSize: 20,
    textAlign: 'center',
  },
});

export default App;
