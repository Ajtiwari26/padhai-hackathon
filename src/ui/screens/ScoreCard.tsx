import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme/theme';
import { TestEntry, TestQuestion } from '../../core/storage/TestStore';

export const ScoreCard: React.FC<{ route: any, navigation: any }> = ({ route, navigation }) => {
  const { test } = route.params as { test: TestEntry };

  const handleReviewDoubt = (question: TestQuestion) => {
    navigation.navigate('QuestionDoubtSolver', { question, topic: test.topic });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Test Completed</Text>
          <Text style={styles.score}>{test.score} / {test.maxScore}</Text>
          <Text style={styles.subtitle}>Total Score</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { borderColor: '#10b981' }]}>
            <Text style={styles.statNum}>{test.correctCount}</Text>
            <Text style={styles.statLabel}>Correct (+4)</Text>
          </View>
          <View style={[styles.statBox, { borderColor: '#ef4444' }]}>
            <Text style={styles.statNum}>{test.wrongCount}</Text>
            <Text style={styles.statLabel}>Wrong (-1)</Text>
          </View>
          <View style={[styles.statBox, { borderColor: Theme.colors.border }]}>
            <Text style={styles.statNum}>{test.skippedCount}</Text>
            <Text style={styles.statLabel}>Skipped (0)</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Question Breakdown</Text>
        
        {test.data?.map((q, i) => {
          const isCorrect = q.studentAnswer === q.correctAnswer;
          const isSkipped = !q.studentAnswer;
          
          return (
            <View key={q.id} style={styles.qCard}>
              <View style={styles.qHeader}>
                <Text style={styles.qNum}>Q{i+1}</Text>
                <Text style={[
                  styles.qStatus, 
                  isCorrect ? styles.txtCorrect : isSkipped ? styles.txtSkipped : styles.txtWrong
                ]}>
                  {isCorrect ? 'Correct' : isSkipped ? 'Skipped' : 'Wrong'}
                </Text>
              </View>
              <Text style={styles.qText}>{q.problem}</Text>
              <Text style={styles.qAns}>Your Answer: {q.studentAnswer || 'None'}</Text>
              <Text style={styles.qCorrectAns}>Correct Answer: {q.correctAnswer}</Text>
              
              {!isCorrect && !isSkipped && (
                <TouchableOpacity 
                  style={styles.doubtBtn}
                  onPress={() => handleReviewDoubt(q)}
                >
                  <Text style={styles.doubtBtnText}>Ask AI Mentor</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        
        <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.navigate('TestsHub')}>
          <Text style={styles.doneBtnText}>Back to Tests</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  scroll: { padding: 20 },
  header: { alignItems: 'center', marginVertical: 30 },
  title: { color: Theme.colors.text, fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  score: { color: Theme.colors.primary, fontSize: 48, fontWeight: 'bold' },
  subtitle: { color: Theme.colors.textMuted, fontSize: 16 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  statBox: { flex: 1, alignItems: 'center', padding: 15, borderWidth: 1, borderRadius: 12, marginHorizontal: 5, backgroundColor: Theme.colors.surface },
  statNum: { color: Theme.colors.text, fontSize: 24, fontWeight: 'bold' },
  statLabel: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 5 },
  sectionTitle: { color: Theme.colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  qCard: { backgroundColor: Theme.colors.surface, padding: 15, borderRadius: 12, marginBottom: 15 },
  qHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  qNum: { color: Theme.colors.textMuted, fontWeight: 'bold' },
  qStatus: { fontWeight: 'bold' },
  txtCorrect: { color: '#10b981' },
  txtWrong: { color: '#ef4444' },
  txtSkipped: { color: Theme.colors.textMuted },
  qText: { color: Theme.colors.text, marginBottom: 10 },
  qAns: { color: Theme.colors.textMuted, marginBottom: 5 },
  qCorrectAns: { color: '#10b981', fontWeight: 'bold', marginBottom: 15 },
  doubtBtn: { backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 10, borderRadius: 8, alignItems: 'center' },
  doubtBtnText: { color: Theme.colors.primary, fontWeight: 'bold' },
  doneBtn: { backgroundColor: Theme.colors.primary, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
