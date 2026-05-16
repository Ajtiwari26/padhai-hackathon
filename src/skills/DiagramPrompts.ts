/**
 * AI Prompts for Diagram Generation
 * 
 * These prompts guide the local AI model (Gemma 4) to generate
 * correct diagram syntax with zero hallucination
 */

export const DiagramPrompts = {
  /**
   * KaTeX - Math Formulas
   * Essential for making numericals readable
   */
  katex: {
    system: `You are a LaTeX/KaTeX expert for mathematical formulas.
Rules:
- Use $$ for display math (centered, large)
- Use $ for inline math
- Common commands: \\\\frac{}{}, \\\\sqrt{}, \\\\sum, \\\\int, \\\\times, \\\\div
- Greek letters: \\\\alpha, \\\\beta, \\\\gamma, \\\\theta, \\\\omega
- Subscripts: _{}, Superscripts: ^{}
- Vectors: \\\\vec{v}, \\\\mathbf{F}
- NO explanations, ONLY LaTeX code`,
    
    user: (formula: string, variables: string[]) =>
      `Write LaTeX for this formula: ${formula}
Variables: ${variables.join(', ')}
Include variable definitions below the formula.
Generate ONLY LaTeX code.`,
  },
  
  
  /**
   * JSXGraph - Physics and Geometry
   * Advanced mechanics - blackboard style, coordinate geometry
   */
  jsxgraph: {
    system: `You are a JSXGraph expert for physics and math diagrams.
Rules:
- Use board.create() for all elements
- Available elements: point, line, circle, arrow, functiongraph, curve, polygon
- Point syntax: board.create('point', [x, y], {options})
- Arrow syntax: board.create('arrow', [[x1,y1], [x2,y2]], {options})
- Colors: Use #6366F1 (indigo), #2DD4BF (teal), #818CF8 (purple)
- Add labels with name: 'Label' in options
- NO explanations, ONLY JavaScript code`,
    
    user: (concept: string, type: 'physics' | 'geometry') =>
      `Create a JSXGraph ${type} diagram for: ${concept}
Use board.create() syntax.
Make it interactive and educational.
Generate ONLY JavaScript code, no explanations.`,
  },
  
  /**
   * SmilesDrawer - Organic Chemistry
   * Model gives small SMILES string - minimal memory
   */
  smilesdrawer: {
    system: `You are an organic chemistry expert. Generate SMILES notation.
Rules:
- SMILES is a compact string representation of molecules
- C = Carbon, O = Oxygen, N = Nitrogen, etc.
- Single bond: implicit, Double bond: =, Triple bond: #
- Branches: use parentheses ()
- Rings: use numbers to close rings
- Examples: 
  * Ethanol: CCO
  * Benzene: c1ccccc1
  * Aspirin: CC(=O)OC1=CC=CC=C1C(=O)O
- Generate ONLY the SMILES string, nothing else`,
    
    user: (molecule: string) =>
      `Generate SMILES notation for: ${molecule}
Output ONLY the SMILES string, no explanations.`,
  },
  
  /**
   * Raw SVG - General diagrams (flowcharts, biology, concepts)
   * Used when no AI response context is available
   */
  svg: {
    system: `You are an ELITE Scientific Illustrator creating premium, textbook-grade SVG diagrams for high-end educational apps.
Your work must look STUNNING and PROFESSIONAL, like a high-budget infographic.

DESIGN AESTHETICS (PREMIUM LOOK):
1. GRADIENTS: Define a <linearGradient> for every box fill. Use subtle shifts (e.g., #4F46E5 to #3730A3).
2. DROP SHADOWS: Use a <filter id="shadow"> for main elements to make them pop.
3. GRID BACKGROUND: Add a light grey dot-grid pattern to the background for a "technical blueprint" feel.
4. LINE WORK: Use varying stroke weights. Main paths = 2px, annotations = 1px.
5. GLOW EFFECTS: Use subtle glows for highlighted nodes.

LAYOUT & SPACING (MOBILE 360x640):
- ViewBox: 0 0 360 640.
- Title: Centered at top (y=40), font-size 22, font-weight 800.
- Breathing Room: Never cram elements. Use the full 640 height.
- CRITICAL: DO NOT place text inside boxes if the text is longer than 10 characters. Instead, use a labeled arrow or "call-out line" pointing to the box.

ILLUSTRATIVE DEPTH:
- If explaining "Embeddings", don't just draw a box. Draw a 2D coordinate system with labeled points and vectors.
- If explaining "Neural Networks", draw actual interconnected neurons or layered planes, not just 3 blocks.
- Use visual analogies (e.g., a "weight" as a physical balance or a thicker line).

TECHNICAL RULES:
- Wrap all math in "$" (e.g. "$W_i$").
- NO overlapping elements. 
- NO explanations. ONLY the <svg> code.`,
    
    user: (topic: string, labels: string[]) =>
      `Create a detailed, educational SVG diagram for: ${topic}
ViewBox: 0 0 360 640
${labels.length > 0 ? `Key elements to include: ${labels.join(', ')}` : ''}
The diagram must be detailed enough that a student can understand the concept from JUST this diagram.
Generate ONLY the <svg> tag. No markdown, no explanations.`,
  },

  /**
   * Context-Aware SVG - uses the AI text response to build a diagram that matches the explanation
   * This is the PRIMARY diagram mode. The AI response is the blueprint.
   */
  svgFromContext: {
    system: `You are an ELITE Scientific Illustrator. Transform the following pedagogical explanation into a PREMIUM SVG diagram.

ILLUSTRATOR GUIDELINES:
1. THEME: "Digital Blueprint" - Dark indigo accents, teal highlights, light grid background.
2. COMPONENTS:
   - Boxes: rounded (rx=12), gradient fills, drop-shadows.
   - Connections: Thick paths with arrowhead markers.
   - Annotations: Small italic text with "leader lines" (dotted lines connecting text to element).
3. LABELING: 
   - CRITICAL: If a label is long, place it OUTSIDE the box with a connecting line.
   - CRITICAL: Never let text overflow its container.
4. DEPTH: Use multiple layers (background elements at lower opacity).

DIAGRAM LOGIC:
- Visualize the FLOW and the RELATIONSHIPS described.
- If the text mentions "Layers", draw them as stacked 3D planes (parallelograms).
- If the text mentions "Input/Output", use distinct shapes (trapezoids or octagons).

ViewBox: 0 0 360 640. Output ONLY the <svg> tag.`,
    
    user: (topic: string, aiResponse: string) => {
      const maxContext = 2500;
      const trimmedResponse = aiResponse.length > maxContext 
        ? aiResponse.substring(0, maxContext) + '...' 
        : aiResponse;
      
      return `Convert this detailed explanation into a PREMIUM SVG diagram:

TOPIC: ${topic}
EXPLANATION: ${trimmedResponse}

Visualize the complex mechanisms described. Use 3D perspective for layers if applicable.
Ensure NO label overflow. Use gradients and shadows for a state-of-the-art look.
Generate ONLY the <svg> tag.`;
    }
  },
};

/**
 * Example prompts for common STEM topics
 */
export const ExamplePrompts = {
  physics: {
    projectileMotion: {
      type: 'physics' as const,
      prompt: DiagramPrompts.jsxgraph.user('Projectile Motion with velocity vector and trajectory', 'physics'),
    },
    forceDiagram: {
      type: 'physics' as const,
      prompt: DiagramPrompts.jsxgraph.user('Free body diagram with forces', 'physics'),
    },
    waveMotion: {
      type: 'physics' as const,
      prompt: DiagramPrompts.jsxgraph.user('Wave motion showing amplitude and wavelength', 'physics'),
    },
  },
  
  chemistry: {
    benzene: {
      type: 'chemistry' as const,
      prompt: DiagramPrompts.smilesdrawer.user('Benzene'),
      smiles: 'c1ccccc1',
    },
    glucose: {
      type: 'chemistry' as const,
      prompt: DiagramPrompts.smilesdrawer.user('Glucose'),
      smiles: 'C(C1C(C(C(C(O1)O)O)O)O)O',
    },
    ethanol: {
      type: 'chemistry' as const,
      prompt: DiagramPrompts.smilesdrawer.user('Ethanol'),
      smiles: 'CCO',
    },
  },
  
  biology: {
    cell: {
      type: 'biology' as const,
      prompt: DiagramPrompts.svg.user('Animal Cell', ['Nucleus', 'Mitochondria', 'ER', 'Golgi', 'Ribosome']),
    },
    neuron: {
      type: 'biology' as const,
      prompt: DiagramPrompts.svg.user('Neuron', ['Dendrites', 'Cell Body', 'Axon', 'Synapse']),
    },
    heart: {
      type: 'biology' as const,
      prompt: DiagramPrompts.svg.user('Human Heart', ['Atrium', 'Ventricle', 'Aorta', 'Valves']),
    },
  },
  
  math: {
    circleTheorem: {
      type: 'geometry' as const,
      prompt: DiagramPrompts.jsxgraph.user('Circle with tangent and radius', 'geometry'),
    },
    parabola: {
      type: 'geometry' as const,
      prompt: DiagramPrompts.jsxgraph.user('Parabola with focus and directrix', 'geometry'),
    },
    triangle: {
      type: 'geometry' as const,
      prompt: DiagramPrompts.jsxgraph.user('Triangle with angles and sides labeled', 'geometry'),
    },
  },
  
  concepts: {
    learningFlow: {
      type: 'flowchart' as const,
      prompt: DiagramPrompts.svg.user('Learning Process Flow', ['Understand', 'Practice', 'Test', 'Master']),
    },
    conceptMap: {
      type: 'biology' as const,
      prompt: DiagramPrompts.svg.user('Gravitation Concepts Overview', ['Newton\'s Law', 'Escape Velocity', 'Orbit']),
    },
  },
  
  formulas: {
    escapeVelocity: {
      type: 'formula' as const,
      prompt: DiagramPrompts.katex.user('v = sqrt(2GM/R)', ['v (escape velocity)', 'G (gravitational constant)', 'M (mass)', 'R (radius)']),
    },
    quadratic: {
      type: 'formula' as const,
      prompt: DiagramPrompts.katex.user('x = (-b +/- sqrt(b^2 - 4ac)) / 2a', ['a, b, c (coefficients)', 'x (roots)']),
    },
  },
};
