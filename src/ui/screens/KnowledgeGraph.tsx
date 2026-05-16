import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Theme, getConfidenceColor } from '../theme/theme';

import { KnowledgeGraphBuilder, GraphNode, GraphEdge } from '../../core/analytics/KnowledgeGraphBuilder';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  navigation: any;
}

export const KnowledgeGraph: React.FC<Props> = ({ navigation }) => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  
  // Dynamic state from builder
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [insights, setInsights] = useState<{type: 'strength'|'weakness'|'suggestion', text: string, icon: string}[]>([]);

  useEffect(() => {
    // Load from storage on mount
    const { nodes, edges } = KnowledgeGraphBuilder.getGraph();
    setGraphNodes(nodes);
    setGraphEdges(edges);
    setInsights(KnowledgeGraphBuilder.getInsights());
  }, []);

  const selectedNodeData = graphNodes.find(n => n.id === selectedNode);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.pageTitle}>Knowledge Map</Text>
        <Text style={styles.pageSubtitle}>
          What Padh.ai knows about your understanding
        </Text>

        {/* View Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'graph' && styles.toggleBtnActive]}
            onPress={() => setViewMode('graph')}
          >
            <Text style={[styles.toggleText, viewMode === 'graph' && styles.toggleTextActive]}>
              Graph View
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>
              List View
            </Text>
          </TouchableOpacity>
        </View>

        {/* Graph Canvas */}
        {viewMode === 'graph' ? (
          <View style={styles.graphCanvas}>
            {/* Edges using react-native-svg for beautiful curved paths */}
            <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
              {graphEdges.map((edge, i) => {
                const fromNode = graphNodes.find(n => n.id === edge.from);
                const toNode = graphNodes.find(n => n.id === edge.to);
                if (!fromNode || !toNode) return null;
                
                const startX = fromNode.x * (SCREEN_WIDTH - 40);
                const startY = fromNode.y * 400;
                const endX = toNode.x * (SCREEN_WIDTH - 40);
                const endY = toNode.y * 400;
                
                // Calculate control points for a smooth cubic Bezier curve
                const cp1X = startX;
                const cp1Y = startY + (endY - startY) / 2;
                const cp2X = endX;
                const cp2Y = startY + (endY - startY) / 2;
                
                const d = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
                
                return (
                  <Path
                    key={`edge-${i}`}
                    d={d}
                    stroke="rgba(255, 255, 255, 0.15)"
                    strokeWidth={2}
                    fill="none"
                    strokeDasharray={fromNode.confidence === 0 || toNode.confidence === 0 ? "4,4" : undefined}
                  />
                );
              })}
            </Svg>

            {/* Nodes */}
            {graphNodes.map(node => (
              <TouchableOpacity
                key={node.id}
                style={[styles.graphNode, {
                  left: node.x * (SCREEN_WIDTH - 40) - node.size / 2,
                  top: node.y * 400 - node.size / 2,
                  width: node.size,
                  height: node.size,
                  borderRadius: node.size / 2,
                  backgroundColor: getConfidenceColor(node.confidence) + '25',
                  borderColor: getConfidenceColor(node.confidence),
                  borderWidth: selectedNode === node.id ? 3 : 1.5,
                }]}
                onPress={() => setSelectedNode(node.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.nodeScore, {
                  color: getConfidenceColor(node.confidence),
                  fontSize: node.size * 0.28,
                }]}>
                  {node.confidence > 0 ? `${node.confidence}` : '?'}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Node labels */}
            {graphNodes.map(node => (
              <Text
                key={`label-${node.id}`}
                style={[styles.nodeLabel, {
                  left: node.x * (SCREEN_WIDTH - 40) - 40,
                  top: node.y * 400 + node.size / 2 + 4,
                }]}
                numberOfLines={1}
              >
                {node.label}
              </Text>
            ))}
          </View>
        ) : graphNodes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>Your mindmap is empty.</Text>
            <Text style={styles.emptyStateDesc}>Start chatting with the AI Mentor or complete tests to build your knowledge map.</Text>
          </View>
        ) : (
          /* List View */
          <View style={styles.listView}>
            {[...graphNodes].sort((a, b) => b.confidence - a.confidence).map(node => (
              <TouchableOpacity
                key={node.id}
                style={styles.listItem}
                onPress={() => navigation.navigate('MentorChat', { topic: node.label })}
                activeOpacity={0.7}
              >
                <View style={[styles.listDot, { backgroundColor: getConfidenceColor(node.confidence) }]} />
                <View style={styles.listInfo}>
                  <Text style={styles.listTitle}>{node.label}</Text>
                  <Text style={styles.listSubject}>{node.subject}</Text>
                </View>
                <View style={styles.listScore}>
                  <Text style={[styles.listScoreText, { color: getConfidenceColor(node.confidence) }]}>
                    {node.confidence}%
                  </Text>
                  <View style={styles.listBarBg}>
                    <View style={[styles.listBarFill, {
                      width: `${node.confidence}%`,
                      backgroundColor: getConfidenceColor(node.confidence),
                    }]} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Selected Node Detail */}
        {selectedNodeData && (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>{selectedNodeData.label}</Text>
            <Text style={styles.detailSubject}>{selectedNodeData.subject}</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Confidence</Text>
              <Text style={[styles.detailValue, {
                color: getConfidenceColor(selectedNodeData.confidence),
              }]}>{selectedNodeData.confidence}%</Text>
            </View>
            <TouchableOpacity
              style={styles.detailBtn}
              onPress={() => navigation.navigate('MentorChat', { topic: selectedNodeData.label })}
            >
              <Text style={styles.detailBtnText}>
                {selectedNodeData.confidence > 0 ? 'Continue Learning →' : 'Start Learning →'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* AI Insights */}
        <Text style={styles.insightHeader}>AI Insights</Text>
        {insights.map((insight, i) => (
          <View key={i} style={[styles.insightCard, {
            borderLeftColor: insight.type === 'strength' ? Theme.colors.success
              : insight.type === 'weakness' ? Theme.colors.warning
              : Theme.colors.info,
          }]}>
            <Text style={styles.insightIcon}>{insight.icon}</Text>
            <Text style={styles.insightText}>{insight.text}</Text>
          </View>
        ))}

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
    fontSize: 28,
    fontWeight: '800',
    color: Theme.colors.text,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 14,
    color: Theme.colors.textMuted,
    marginTop: 4,
    marginBottom: 20,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: Theme.colors.primary,
  },
  toggleBtnTextActive: {
    color: '#000000',
    fontWeight: '600',
  },
  
  // Empty State
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    minHeight: 200,
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 8,
  },
  emptyStateDesc: {
    fontSize: 14,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.textMuted,
  },
  toggleTextActive: {
    color: '#FFF',
  },

  // Graph Canvas
  graphCanvas: {
    height: 440,
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative',
  },
  graphNode: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeScore: {
    fontWeight: '800',
  },
  nodeLabel: {
    position: 'absolute',
    width: 80,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '600',
    color: Theme.colors.textMuted,
  },

  // List View
  listView: {
    marginBottom: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  listDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 14,
  },
  listInfo: { flex: 1 },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  listSubject: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  listScore: {
    alignItems: 'flex-end',
    width: 60,
  },
  listScoreText: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  listBarBg: {
    width: 50,
    height: 3,
    backgroundColor: Theme.colors.surfaceHigh,
    borderRadius: 2,
    overflow: 'hidden',
  },
  listBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Detail Card
  detailCard: {
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorderLight,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  detailSubject: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 2,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  detailValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  detailBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  detailBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Insights
  insightHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 14,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surfaceCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 3,
    gap: 12,
    alignItems: 'flex-start',
  },
  insightIcon: { fontSize: 18, marginTop: 2 },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: Theme.colors.text,
    lineHeight: 20,
  },
});
