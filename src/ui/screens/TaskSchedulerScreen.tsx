/**
 * Task Scheduler Screen
 * 
 * Shows all background tasks with progress, pause/resume/cancel controls
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme/theme';
import { ResourceStore, ResourceTask } from '../../core/storage/ResourceStore';
import { ResourcePlanner } from '../../core/planner/ResourcePlanner';
import { ArrowLeft, Play, Pause, X, CheckCircle, BookOpen, Book, HelpCircle, Calculator, FileText, Dumbbell, ClipboardList } from 'lucide-react-native';

interface Props {
  navigation: any;
}

export const TaskSchedulerScreen: React.FC<Props> = ({ navigation }) => {
  const [tasks, setTasks] = useState<ResourceTask[]>([]);
  const [stats, setStats] = useState({
    queued: 0,
    running: 0,
    done: 0,
    failed: 0,
    total: 0,
    completionPercent: 0
  });
  const [isPaused, setIsPaused] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 2000); // Refresh every 2 seconds
    return () => clearInterval(interval);
  }, []);

  const loadTasks = async () => {
    const allTasks = await ResourceStore.getAllTasks();
    // Sort by priority, then by creation time
    allTasks.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.createdAt - b.createdAt;
    });
    setTasks(allTasks);

    const taskStats = await ResourcePlanner.getStats();
    setStats(taskStats);

    setIsPaused(ResourcePlanner.isPausedStatus());
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTasks();
    setIsRefreshing(false);
  };

  const handlePauseResume = () => {
    if (isPaused) {
      ResourcePlanner.resume();
      setIsPaused(false);
    } else {
      ResourcePlanner.pause();
      setIsPaused(true);
    }
  };

  const handleCancelTask = (task: ResourceTask) => {
    Alert.alert(
      'Cancel Task',
      `Are you sure you want to cancel "${getTaskLabel(task.type)}" for ${task.chapterId}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            await ResourcePlanner.cancelTask(task.id);
            await loadTasks();
          }
        }
      ]
    );
  };

  const getTaskLabel = (type: ResourceTask['type']): string => {
    const labels: Record<ResourceTask['type'], string> = {
      syllabus: 'Syllabus Generation',
      subtopic: 'Chapter Enrichment',
      mcq: 'MCQ Generation',
      numerical: 'Numerical Problem',
      test: 'Chapter Test',
      dpp: 'Daily Practice Problems',
      summary: 'Chapter Summary',
      mcq_batch: 'MCQ Batch',
      numerical_batch: 'Numerical Batch'
    };
    return labels[type] || type;
  };

  const getTaskIcon = (type: ResourceTask['type']): React.ReactNode => {
    const props = { size: 24, color: Theme.colors.text };
    switch (type) {
      case 'syllabus': return <BookOpen {...props} />;
      case 'subtopic': return <Book {...props} />;
      case 'mcq': return <HelpCircle {...props} />;
      case 'numerical': return <Calculator {...props} />;
      case 'test': return <FileText {...props} />;
      case 'dpp': return <Dumbbell {...props} />;
      case 'summary': return <ClipboardList {...props} />;
      case 'mcq_batch': return <HelpCircle {...props} />;
      case 'numerical_batch': return <Calculator {...props} />;
      default: return <FileText {...props} />;
    }
  };

  const getStatusColor = (status: ResourceTask['status']): string => {
    switch (status) {
      case 'queued': return '#f59e0b'; // Orange
      case 'running': return '#3b82f6'; // Blue
      case 'done': return '#10b981'; // Green
      case 'failed': return '#ef4444'; // Red
      default: return Theme.colors.textMuted;
    }
  };

  const getStatusLabel = (status: ResourceTask['status']): string => {
    switch (status) {
      case 'queued': return 'Queued';
      case 'running': return 'Running...';
      case 'done': return 'Completed';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Task Scheduler</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.queued}</Text>
            <Text style={styles.statLabel}>Queued</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#3b82f6' }]}>{stats.running}</Text>
            <Text style={styles.statLabel}>Running</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.done}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${stats.completionPercent}%` }]} />
          </View>
          <Text style={styles.progressText}>{stats.completionPercent}% Complete</Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlBtn, isPaused ? styles.resumeBtn : styles.pauseBtn]}
            onPress={handlePauseResume}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isPaused ? <Play size={16} color="#FFF" /> : <Pause size={16} color="#FFF" />}
              <Text style={styles.controlBtnText}>
                {isPaused ? 'Resume' : 'Pause'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Task List */}
      <ScrollView
        style={styles.taskList}
        contentContainerStyle={styles.taskListContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <CheckCircle size={64} color={Theme.colors.primary} style={{ marginBottom: 16 }} />
            <Text style={styles.emptyText}>No tasks in queue</Text>
            <Text style={styles.emptySubtext}>All background work is complete!</Text>
          </View>
        ) : (
          tasks.map((task) => (
            <View key={task.id} style={styles.taskCard}>
              <View style={styles.taskHeader}>
                <View style={styles.taskTitleRow}>
                  <View style={styles.taskIcon}>{getTaskIcon(task.type)}</View>
                  <View style={styles.taskInfo}>
                    <Text style={styles.taskTitle}>{getTaskLabel(task.type)}</Text>
                    <Text style={styles.taskSubtitle}>{task.chapterId}</Text>
                    {task.subtopic && (
                      <Text style={styles.taskSubtopic}>• {task.subtopic}</Text>
                    )}
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(task.status) }]}>
                    {getStatusLabel(task.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.taskFooter}>
                <Text style={styles.taskTime}>
                  Priority: {task.priority} • {new Date(task.createdAt).toLocaleTimeString()}
                </Text>
                {(task.status === 'queued' || task.status === 'running') && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => handleCancelTask(task)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <X size={12} color="#ef4444" />
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.glassBorder,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: Theme.colors.text,
    fontSize: 20,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  placeholder: {
    width: 40,
  },
  statsCard: {
    margin: 16,
    padding: 16,
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 4,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: Theme.colors.surfaceHigh,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
  },
  controlBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseBtn: {
    backgroundColor: '#f59e0b',
  },
  resumeBtn: {
    backgroundColor: '#10b981',
  },
  controlBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  taskList: {
    flex: 1,
  },
  taskListContent: {
    padding: 16,
    paddingTop: 0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Theme.colors.textMuted,
  },
  taskCard: {
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  taskIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  taskSubtitle: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginBottom: 2,
  },
  taskSubtopic: {
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskTime: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ef444420',
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
});
