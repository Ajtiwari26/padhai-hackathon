/**
 * Diagram Generator Skill
 * 
 * Generates diagrams for STEM learning using optimal libraries:
 * - KaTeX: Math formulas
 * - JSXGraph: Physics/Math interactive diagrams
 * - SmilesDrawer: Organic chemistry structures
 * - Raw SVG: All general illustrations, flowcharts, and mind maps
 */

export type DiagramType = 
  | 'flowchart'      
  | 'process'        
  | 'sequence'       
  | 'formula'        
  | 'physics'        
  | 'geometry'       
  | 'chemistry'      
  | 'biology'
  | 'mermaid';       

export interface DiagramRequest {
  type: DiagramType;
  topic: string;
  subtopic?: string;
  difficulty: number; // 0-100
  content: string;    // The actual diagram content/code
  metadata?: {
    subject?: string;
    concepts?: string[];
    interactive?: boolean;
  };
}

export interface GeneratedDiagram {
  id: string;
  type: DiagramType;
  library: string;
  code: string;
  renderHtml: string;
  metadata: {
    topic: string;
    difficulty: number;
    generatedAt: number;
  };
}

class DiagramGeneratorService {
  /**
   * Generate a diagram based on request
   */
  async generate(request: DiagramRequest): Promise<GeneratedDiagram> {
    const id = `diagram_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let library: string;
    let code: string;
    let renderHtml: string;
    
    switch (request.type) {
      case 'formula':
        library = 'katex';
        code = request.content;
        renderHtml = this.generateKaTeXHtml(code);
        break;
      
      case 'physics':
      case 'geometry':
        library = 'jsxgraph';
        code = request.content;
        renderHtml = this.generateJSXGraphHtml(code, request.type);
        break;
      
      case 'chemistry':
        library = 'smilesdrawer';
        code = request.content;
        renderHtml = this.generateSmilesDrawerHtml(code);
        break;
      
      case 'mermaid':
        library = 'svg';
        code = request.content;
        renderHtml = this.generateSVGHtml(code);
        break;

      case 'biology':
      case 'flowchart':
      case 'process':
      case 'sequence':
      default:
        library = 'svg';
        code = request.content;
        renderHtml = this.generateSVGHtml(code);
        break;
    }
    
    return {
      id,
      type: request.type,
      library,
      code,
      renderHtml,
      metadata: {
        topic: request.topic,
        difficulty: request.difficulty,
        generatedAt: Date.now(),
      },
    };
  }
  
  /**
   * Public helper to generate HTML for any diagram (useful for re-hydration)
   */
  public getHtmlForLibrary(library: string, code: string): string {
    switch (library) {
      case 'katex': return this.generateKaTeXHtml(code);
      case 'jsxgraph': return this.generateJSXGraphHtml(code, 'physics');
      case 'smilesdrawer': return this.generateSmilesDrawerHtml(code);
      case 'svg': return this.generateSVGHtml(code);
      default: return this.generateSVGHtml(code);
    }
  }

  /**
   * Generate Mermaid HTML
   */
  private generateMermaidHtml(mermaidCode: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: #ffffff;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    #diagram {
      width: 100%;
    }
  </style>
</head>
<body>
  <div id="diagram" class="mermaid">
    ${mermaidCode}
  </div>
  <script>
    mermaid.initialize({ 
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' }
    });
  </script>
</body>
</html>`;
  }

  /**
   * Generate KaTeX HTML
   */
  private generateKaTeXHtml(latexCode: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: -apple-system, sans-serif;
      color: #000000;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100vw;
      height: 100vh;
      overflow: auto;
    }
    .formula-container {
      background: #f8fafc;
      border-radius: 16px;
      padding: 40px;
      border: 1px solid #e2e8f0;
      width: 90%;
      max-width: 800px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      display: flex;
      justify-content: center;
    }
    .katex {
      font-size: 1.8em;
      color: #000000;
    }
  </style>
</head>
<body>
  <div class="formula-container">
    <div id="formula">${latexCode}</div>
  </div>
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      renderMathInElement(document.body, {
        delimiters: [
          {left: "$$", right: "$$", display: true},
          {left: "$", right: "$", display: false},
          {left: "\\\\[", right: "\\\\]", display: true},
          {left: "\\\\(", right: "\\\\)", display: false}
        ],
        throwOnError: false
      });
    });
  </script>
</body>
</html>`;
  }
  
  /**
   * Generate JSXGraph HTML
   */
  private generateJSXGraphHtml(jsxCode: string, type: 'physics' | 'geometry'): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/jsxgraph@1.6.2/distrib/jsxgraph.css">
  <script src="https://cdn.jsdelivr.net/npm/jsxgraph@1.6.2/distrib/jsxgraphcore.js"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }
    #jxgbox {
      width: 98vw;
      height: 98vh;
      max-width: 100%;
      max-height: 100%;
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  <div id="jxgbox" class="jxgbox"></div>
  <script>
    const board = JXG.JSXGraph.initBoard('jxgbox', {
      boundingbox: [-5, 8, 5, -2],
      axis: true,
      showCopyright: false,
      showNavigation: true,
      keepaspectratio: true,
      grid: true
    });
    ${jsxCode}
  </script>
</body>
</html>`;
  }
  
  /**
   * Generate SmilesDrawer HTML
   */
  private generateSmilesDrawerHtml(smilesString: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/smiles-drawer@2.0.1/dist/smiles-drawer.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100vw;
      height: 100vh;
      overflow: auto;
    }
    canvas {
      background: white;
      max-width: 95%;
      max-height: 95%;
    }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const width = window.innerWidth * 0.9;
    const height = window.innerHeight * 0.8;
    canvas.width = width;
    canvas.height = height;
    
    let smilesDrawer = new SmilesDrawer.Drawer({ width, height });
    SmilesDrawer.parse('${smilesString}', function(tree) {
      smilesDrawer.draw(tree, 'canvas', 'light', false);
    });
  </script>
</body>
</html>`;
  }
  
  /**
   * Generate Raw SVG HTML with KaTeX support
   */
  private generateSVGHtml(svgContent: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=4.0, user-scalable=yes">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    }
    body {
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .svg-container {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0;
      padding: 0;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
      margin: auto;
      background: transparent;
      overflow: visible !important;
    }
    svg text {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      fill: #000000;
    }
    .math-container {
      display: block;
      width: 100%;
      color: #000000;
      background: transparent;
      line-height: 1;
    }
    .katex-display {
      margin: 0 !important;
    }
  </style>
</head>
<body>
  <div class="svg-container">
    ${svgContent}
  </div>
  <script>
    function renderMathLabels() {
      const textElements = document.querySelectorAll('svg text');
      textElements.forEach(el => {
        const text = el.textContent.trim();
        // We will process KaTeX if $ is present, OR if it's just normal text, we can leave it
        // But to ensure exact positioning matches SVG text-anchor, we only replace if it contains math.
        if (text.includes('$')) {
          const x = el.getAttribute('x') || '0';
          const y = el.getAttribute('y') || '0';
          const fontSize = el.getAttribute('font-size') || '14';
          const textAnchor = el.getAttribute('text-anchor') || 'start';
          
          const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
          const width = 200; // Restricted width to prevent clipping
          const height = 80;
          
          // Adjust x based on text-anchor so the 400px block aligns correctly
          let foX = parseFloat(x);
          if (textAnchor === 'middle') foX -= width/2;
          else if (textAnchor === 'end') foX -= width;
          
          fo.setAttribute('x', foX);
          fo.setAttribute('y', parseFloat(y) - (parseFloat(fontSize) + 2)); // Offset upwards to align baseline properly
          fo.setAttribute('width', width);
          fo.setAttribute('height', height);
          fo.style.overflow = 'visible';
          
          const div = document.createElement('div');
          div.className = 'math-container';
          div.style.fontSize = fontSize + 'px';
          div.style.textAlign = textAnchor === 'middle' ? 'center' : (textAnchor === 'end' ? 'right' : 'left');
          div.innerHTML = text;
          
          try {
            fo.appendChild(div);
            el.parentNode.replaceChild(fo, el);
            renderMathInElement(div, {
              delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false}
              ],
              throwOnError: false
            });
          } catch (e) {
            console.error('KaTeX render error:', e);
          }
        }
      });
    }

    document.querySelectorAll('svg').forEach(function(svg) {
      // Auto-frame: Calculate the actual bounding box of all content
      try {
        // We wait for KaTeX to finish if it's there
        setTimeout(() => {
          const bbox = svg.getBBox();
          const padding = 50; // Requested "zoomed out" padding
          const newViewBox = [
            bbox.x - padding,
            bbox.y - padding,
            bbox.width + (padding * 2),
            bbox.height + (padding * 2)
          ].join(' ');
          
          svg.setAttribute('viewBox', newViewBox);
          svg.style.width = '100%';
          svg.style.height = '100%';
          svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        }, 300);
      } catch (e) {
        console.error('Auto-frame error:', e);
        // Fallback to existing viewBox or dimensions
        if (!svg.getAttribute('viewBox') && svg.getAttribute('width') && svg.getAttribute('height')) {
          svg.setAttribute('viewBox', '0 0 ' + svg.getAttribute('width') + ' ' + svg.getAttribute('height'));
        }
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
    });

    setTimeout(renderMathLabels, 50);
  </script>
</body>
</html>`;
  }
  
  /**
   * Generate example diagrams
   */
  getExamples(): Record<DiagramType, string> {
    return {
      flowchart: `<svg viewBox="0 0 360 640" xmlns="http://www.w3.org/2000/svg">
  <rect x="80" y="50" width="200" height="60" rx="10" fill="#4F46E5" />
  <text x="180" y="85" text-anchor="middle" fill="#ffffff" font-size="16">Start Learning</text>
  <path d="M 180 110 L 180 160" stroke="#000000" stroke-width="2" />
  <rect x="80" y="160" width="200" height="100" rx="10" fill="#f3f4f6" stroke="#4F46E5" />
  <text x="180" y="215" text-anchor="middle" fill="#000000" font-size="16">Understand Topic?</text>
</svg>`,
      
      process: `<svg viewBox="0 0 360 640" xmlns="http://www.w3.org/2000/svg">
  <circle cx="180" cy="100" r="40" fill="#0D9488" />
  <text x="180" y="160" text-anchor="middle" fill="#000000" font-size="16">Step 1: Input</text>
  <path d="M 180 140 L 180 200" stroke="#000000" stroke-width="2" />
  <rect x="100" y="200" width="160" height="60" fill="#7C3AED" />
  <text x="180" y="235" text-anchor="middle" fill="#ffffff" font-size="16">Step 2: Logic</text>
</svg>`,

      biology: `<svg viewBox="0 0 360 640" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="180" cy="200" rx="100" ry="80" fill="#f3f4f6" stroke="#0D9488" stroke-width="3" />
  <circle cx="180" cy="200" r="30" fill="#4F46E5" opacity="0.6" />
  <text x="180" y="205" text-anchor="middle" fill="#000000">Nucleus</text>
</svg>`,
      
      sequence: `<svg viewBox="0 0 360 640" xmlns="http://www.w3.org/2000/svg">
  <line x1="80" y1="50" x2="80" y2="300" stroke="#000000" stroke-dasharray="4" />
  <line x1="280" y1="50" x2="280" y2="300" stroke="#000000" stroke-dasharray="4" />
  <text x="80" y="40" text-anchor="middle" fill="#000000">A</text>
  <text x="280" y="40" text-anchor="middle" fill="#000000">B</text>
  <path d="M 80 100 L 280 100" stroke="#4F46E5" stroke-width="2" />
  <text x="180" y="90" text-anchor="middle" fill="#000000">Message</text>
</svg>`,

      formula: `$E = mc^2$`,
      physics: `const p1 = board.create('point', [0, 0]);`,
      geometry: `const p1 = board.create('point', [0, 0]);`,
      chemistry: `C1=CC=CC=C1`,
      mermaid: `graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Process]
  B -->|No| D[Stop]`
    };
  }
}

export const DiagramGenerator = new DiagramGeneratorService();
