import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform } from 'react-native';
import { Brain } from 'lucide-react-native';
import { Theme } from '../theme/theme';
import { RichText } from './RichText';
import { DiagramViewer } from './DiagramViewer';
import { DiagramGenerator, GeneratedDiagram } from '../../skills/DiagramGenerator';

interface Props {
  content: string;
  isStreaming?: boolean;
  skillEmoji?: React.ReactNode;
  skillName?: string;
  diagrams?: GeneratedDiagram[];
}

export const AIBubble: React.FC<Props> = ({ content, isStreaming, skillEmoji, skillName, diagrams }) => {
  // Parse content for <think> tags
  const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/;
  const match = content.match(thinkRegex);
  
  const thinkingContent = match ? match[1].trim() : '';
  let bodyContent = content.replace(thinkRegex, '').trim();
  
  // Use passed diagrams directly (No Mermaid extraction)
  const allDiagrams = diagrams || [];

  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [displayedBody, setDisplayedBody] = useState(isStreaming ? '' : bodyContent);
  const typewriterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Typewriter effect for body content
  useEffect(() => {
    // If we are caught up, nothing to do
    if (displayedBody.length >= bodyContent.length) return;

    // If it's NOT streaming and it's an OLD message (not the very last one), 
    // we should show it immediately. 
    // We detect "old" by checking if bodyContent was already set when we mounted.
    // However, for simplicity during onboarding, we'll just drip if we're not caught up.
    
    // How many characters behind we are
    const remaining = bodyContent.length - displayedBody.length;
    // Chunk size: bigger chunks when we're far behind, smaller when catching up
    const chunkSize = remaining > 200 ? 5 : remaining > 50 ? 3 : 1;
    const delay = 8; // 8ms per chunk — fast but still feels like typing
    
    typewriterTimer.current = setTimeout(() => {
      setDisplayedBody(prev => prev + bodyContent.substring(prev.length, prev.length + chunkSize));
    }, delay);

    return () => {
      if (typewriterTimer.current) clearTimeout(typewriterTimer.current);
    };
  }, [bodyContent, displayedBody]);

  const toggleThinking = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsThinkingExpanded(!isThinkingExpanded);
  };

  // If we have thinking content but no body content yet, we are still in the thinking phase
  const isCurrentlyThinking = isStreaming && thinkingContent.length > 0 && bodyContent.length === 0;
  const hasFinishedThinking = thinkingContent.length > 0 && bodyContent.length > 0;

  return (
    <View style={styles.container}>
      {/* Skill Badge if provided */}
      {skillName && (
        <View style={styles.skillBadge}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {skillEmoji}
            <Text style={styles.skillBadgeText}>{skillName}</Text>
          </View>
        </View>
      )}

      {/* Thinking Section */}
      {thinkingContent.length > 0 && (
        <View style={styles.thinkingWrapper}>
          <TouchableOpacity 
            onPress={toggleThinking} 
            activeOpacity={0.7}
            style={[
              styles.thinkingHeader,
              isThinkingExpanded && styles.thinkingHeaderActive
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}>
              <Brain size={14} color={Theme.colors.textMuted} />
              <Text style={styles.thinkingHeaderText}>
                {isStreaming ? "Reasoning..." : "View reasoning steps"}
              </Text>
            </View>
            <Text style={styles.expandIcon}>{isThinkingExpanded ? '−' : '+'}</Text>
          </TouchableOpacity>
          
          {isThinkingExpanded && (
            <View style={styles.thinkingBody}>
              <Text style={styles.thinkingBodyText}>{thinkingContent}</Text>
            </View>
          )}
        </View>
      )}

      {/* Main Body Content */}
      {displayedBody.length > 0 ? (
        <View style={styles.bodyWrapper}>
          <RichText text={displayedBody} />
          {isStreaming && (
            <View style={styles.cursor} />
          )}
        </View>
      ) : null}

      {/* Inline Diagrams */}
      {allDiagrams.length > 0 && !isStreaming && (
        <View style={styles.diagramsWrapper}>
          {allDiagrams.map((diagram, index) => (
            <DiagramViewer key={index} diagram={diagram} />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skillBadge: {
    backgroundColor: Theme.colors.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Theme.colors.primary + '40',
  },
  skillBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thinkingWrapper: {
    backgroundColor: Theme.colors.surfaceMuted,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  thinkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  thinkingHeaderActive: {
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.glassBorder,
  },
  thinkingHeaderText: {
    fontSize: 13,
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.medium,
  },
  expandIcon: {
    color: Theme.colors.textMuted,
    fontSize: 20,
    fontWeight: '300',
  },
  thinkingBody: {
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  thinkingBodyText: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  bodyWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  bodyText: {
    fontSize: 16,
    color: Theme.colors.text,
    lineHeight: 24,
  },
  cursor: {
    width: 8,
    height: 18,
    backgroundColor: Theme.colors.secondary,
    marginLeft: 4,
    marginBottom: 4,
  },
  waitingText: {
    fontSize: 20,
    opacity: 0.5,
  },
  diagramsWrapper: {
    marginTop: 16,
    gap: 12,
  },
});
