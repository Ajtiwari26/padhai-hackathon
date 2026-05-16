import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme } from '../theme/theme';
import { MathText } from './MathText';

const parseInline = (text: string, colorOverride?: string): React.ReactNode[] => {
  const result: React.ReactNode[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|~~(.+?)~~|\$(.+?)\$)/g;
  let lastIndex = 0;
  let match;

  const defaultColor = colorOverride || Theme.colors.text;
  const strongColor = colorOverride || Theme.colors.textOnPrimary;
  const italicColor = colorOverride || Theme.colors.textSecondary;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // ***bold italic***
      result.push(<Text selectable={true} key={`bi-${match.index}`} style={{ fontWeight: '700', fontStyle: 'italic', color: strongColor }}>{match[2]}</Text>);
    } else if (match[3]) {
      // **bold**
      result.push(<Text selectable={true} key={`b-${match.index}`} style={{ fontWeight: '700', color: strongColor }}>{match[3]}</Text>);
    } else if (match[4]) {
      // *italic*
      result.push(<Text selectable={true} key={`i-${match.index}`} style={{ fontStyle: 'italic', color: italicColor }}>{match[4]}</Text>);
    } else if (match[5]) {
      // `code`
      result.push(<Text selectable={true} key={`c-${match.index}`} style={[md.inlineCode, colorOverride ? { color: colorOverride } : {}]}>{match[5]}</Text>);
    } else if (match[6]) {
      // ~~strike~~
      result.push(<Text selectable={true} key={`s-${match.index}`} style={{ textDecorationLine: 'line-through', color: Theme.colors.textMuted }}>{match[6]}</Text>);
    } else if (match[7]) {
      // $math$
      result.push(
        <MathText 
          key={`m-${match.index}`} 
          math={match[7]} 
          inline={true} 
          fontSize={15} 
          color={Theme.colors.accent} 
        />
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result.length > 0 ? result : [text];
};

const MarkdownSection: React.FC<{ text: string, isUser?: boolean }> = ({ text, isUser }) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  const baseTextColor = isUser ? '#FFFFFF' : Theme.colors.text;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      elements.push(
        <View key={`cb-${i}`} style={md.codeBlock}>
          {lang ? <Text style={md.codeLang} selectable={true}>{lang}</Text> : null}
          <Text style={md.codeText} selectable={true}>{codeLines.join('\n')}</Text>
        </View>
      );
      continue;
    }

    // Math block ($$)
    if (line.trim().startsWith('$$')) {
      let isInlineBlock = line.trim().endsWith('$$') && line.trim() !== '$$';
      if (isInlineBlock) {
         elements.push(
           <View key={`math-${i}`} style={md.mathBlock}>
             <MathText math={line.replace(/\$\$/g, '').trim()} inline={false} fontSize={18} color={Theme.colors.accent} />
           </View>
         );
         i++;
         continue;
      } else {
         const mathLines: string[] = [];
         let j = i + 1;
         while (j < lines.length && !lines[j].trim().startsWith('$$')) {
           mathLines.push(lines[j]);
           j++;
         }
         i = j + 1; // skip closing $$
         elements.push(
           <View key={`math-${i}`} style={md.mathBlock}>
             <MathText math={mathLines.join('\n')} inline={false} fontSize={18} color={Theme.colors.accent} />
           </View>
         );
         continue;
      }
    }

    // HR
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      elements.push(<View key={`hr-${i}`} style={md.hr} />);
      i++;
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(<Text selectable={true} key={`h3-${i}`} style={[md.h3, { color: baseTextColor }]}>{parseInline(line.slice(4), baseTextColor)}</Text>);
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<Text selectable={true} key={`h2-${i}`} style={[md.h2, { color: baseTextColor }]}>{parseInline(line.slice(3), baseTextColor)}</Text>);
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<Text selectable={true} key={`h1-${i}`} style={[md.h1, { color: baseTextColor }]}>{parseInline(line.slice(2), baseTextColor)}</Text>);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <View key={`bq-${i}`} style={md.blockquote}>
          <Text selectable={true} style={md.blockquoteText}>{parseInline(line.slice(2), Theme.colors.secondary)}</Text>
        </View>
      );
      i++;
      continue;
    }

    // Bullet list
    if (/^\s*[-*•]\s/.test(line)) {
      const content = line.replace(/^\s*[-*•]\s/, '');
      elements.push(
        <View key={`li-${i}`} style={md.listItem}>
          <Text style={[md.bullet, isUser && { color: '#FFF' }]}>•</Text>
          <Text selectable={true} style={[md.text, { color: baseTextColor, flex: 1 }]}>{parseInline(content, baseTextColor)}</Text>
        </View>
      );
      i++;
      continue;
    }

    // Numbered list
    if (/^\s*\d+\.\s/.test(line)) {
      const match = line.match(/^\s*(\d+)\.\s(.*)/);
      if (match) {
        elements.push(
          <View key={`ol-${i}`} style={md.listItem}>
            <Text style={[md.bullet, isUser && { color: '#FFF' }]}>{match[1]}.</Text>
            <Text selectable={true} style={[md.text, { color: baseTextColor, flex: 1 }]}>{parseInline(match[2], baseTextColor)}</Text>
          </View>
        );
        i++;
        continue;
      }
    }

    // Empty line -> spacer
    if (line.trim() === '') {
      elements.push(<View key={`sp-${i}`} style={{ height: 8 }} />);
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <Text selectable={true} key={`p-${i}`} style={[md.text, { color: baseTextColor }]}>{parseInline(line, baseTextColor)}</Text>
    );
    i++;
  }

  return <View>{elements}</View>;
};

export const RichText: React.FC<{ text: string, isUser?: boolean }> = ({ text, isUser }) => {
  if (!text) return null;
  return <MarkdownSection text={text} isUser={isUser} />;
};

const md = StyleSheet.create({
  text: {
    fontSize: 16,
    color: Theme.colors.text,
    lineHeight: 24,
  },
  h1: { fontSize: 24, fontWeight: '800', marginVertical: 10, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '700', marginVertical: 8, letterSpacing: -0.2 },
  h3: { fontSize: 18, fontWeight: '700', marginVertical: 6 },
  codeBlock: {
    backgroundColor: Theme.colors.surfaceMuted,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  codeLang: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.secondaryLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  codeText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: Theme.colors.textSecondary,
    lineHeight: 20,
  },
  inlineCode: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: Theme.colors.secondaryLight,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: Theme.colors.secondary,
    paddingLeft: 12,
    paddingVertical: 4,
    marginVertical: 6,
    backgroundColor: 'rgba(45, 212, 191, 0.05)',
    borderRadius: 4,
  },
  blockquoteText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: Theme.colors.textSecondary,
    lineHeight: 22,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginVertical: 3,
    paddingLeft: 4,
  },
  bullet: {
    fontSize: 16,
    color: Theme.colors.secondary,
    fontWeight: '700',
    width: 18,
  },
  hr: {
    height: 1,
    backgroundColor: Theme.colors.glassBorder,
    marginVertical: 12,
  },
  mathBlock: {
    backgroundColor: Theme.colors.surfaceMuted,
    padding: 14,
    borderRadius: 8,
    marginVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: Theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mathText: {
    fontSize: 16,
    fontFamily: 'monospace',
    color: Theme.colors.accent,
    lineHeight: 24,
    textAlign: 'center',
  },
  mathInline: {
    fontSize: 15,
    fontFamily: 'monospace',
    color: Theme.colors.accent,
  },
});
