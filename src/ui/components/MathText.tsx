import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

interface MathTextProps {
  math: string;
  inline?: boolean;
  fontSize?: number;
  color?: string;
}

export const MathText: React.FC<MathTextProps> = ({ 
  math, 
  inline = false, 
  fontSize = 16,
  color = '#000000'
}) => {
  const [height, setHeight] = useState(fontSize * 1.5);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: ${inline ? 'flex-start' : 'center'};
      align-items: center;
      background-color: transparent;
      color: ${color};
      font-size: ${fontSize}px;
      overflow: hidden;
    }
    #math {
      padding: ${inline ? '0' : '8px 0'};
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div id="math"></div>
  <script>
    try {
      const math = \`${math.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
      katex.render(math, document.getElementById('math'), {
        displayMode: ${!inline},
        throwOnError: false
      });
      
      // Notify parent of content height
      setTimeout(() => {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ height: document.body.scrollHeight })
        );
      }, 50);
    } catch (e) {
      document.getElementById('math').innerText = math;
    }
  </script>
</body>
</html>
  `;

  return (
    <View style={[
      styles.container, 
      !inline && styles.blockContainer,
      { height: inline ? fontSize * 1.5 : height }
    ]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.height && !inline) {
              setHeight(data.height);
            }
          } catch (e) {}
        }}
        javaScriptEnabled={true}
        transparent={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  blockContainer: {
    width: '100%',
    marginVertical: 4,
  },
  webview: {
    backgroundColor: 'transparent',
  },
});
