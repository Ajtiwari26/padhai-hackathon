/**
 * Diagram Examples - Ready-to-use examples for all 6 libraries
 * 
 * These examples demonstrate each library's capabilities
 * and can be used for testing or as fallbacks
 */

import { DiagramGenerator, DiagramType } from './DiagramGenerator';

export const DiagramExamples = {

  /**
   * 2. KaTeX - Math Formulas
   * Absolute must for numericals - makes them readable
   */
  katex: {
    escapeVelocity: async () => {
      return await DiagramGenerator.generate({
        type: 'formula',
        topic: 'Escape Velocity',
        difficulty: 75,
        content: `$
v_{escape} = \\sqrt{\\frac{2GM}{R}}
$

**जहाँ:**
- $v_{escape}$ = Escape velocity (पलायन वेग)
- $G$ = Gravitational constant = $6.67 \\times 10^{-11}$ N·m²/kg²
- $M$ = Planet का mass
- $R$ = Planet की radius

**Derivation:**
$$
\\frac{1}{2}mv^2 = \\frac{GMm}{R}
$$
$$
v = \\sqrt{\\frac{2GM}{R}}
$$`,
      });
    },

    quadraticFormula: async () => {
      return await DiagramGenerator.generate({
        type: 'formula',
        topic: 'Quadratic Formula',
        difficulty: 50,
        content: `$
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$

**For equation:** $ax^2 + bx + c = 0$

**Discriminant:** $\\Delta = b^2 - 4ac$
- $\\Delta > 0$ → दो real roots
- $\\Delta = 0$ → एक repeated root
- $\\Delta < 0$ → दो complex roots`,
      });
    },

    kineticEnergy: async () => {
      return await DiagramGenerator.generate({
        type: 'formula',
        topic: 'Kinetic Energy',
        difficulty: 40,
        content: `$
KE = \\frac{1}{2}mv^2
$

**Work-Energy Theorem:**
$$
W = \\Delta KE = KE_f - KE_i
$$

**Units:**
- $m$ = mass (kg)
- $v$ = velocity (m/s)
- $KE$ = energy (Joules)`,
      });
    },
  },


  /**
   * 4. JSXGraph - Physics & Geometry
   * Advanced mechanics - blackboard style
   */
  jsxgraph: {
    projectileMotion: async () => {
      return await DiagramGenerator.generate({
        type: 'physics',
        topic: 'Projectile Motion',
        difficulty: 80,
        content: `// Initial conditions
var v0 = 20;  // m/s
var angle = 45;  // degrees
var g = 9.8;  // m/s²

// Launch point
var origin = board.create('point', [0, 0], {
  name: 'O',
  size: 4,
  fillColor: '#2DD4BF',
  strokeColor: '#2DD4BF',
  fixed: true
});

// Velocity vector
var vx = v0 * Math.cos(angle * Math.PI / 180);
var vy = v0 * Math.sin(angle * Math.PI / 180);

var velocityVector = board.create('arrow', [[0, 0], [vx/2, vy/2]], {
  strokeColor: '#6366F1',
  strokeWidth: 3,
  lastArrow: {type: 2, size: 8}
});

board.create('text', [vx/2 + 1, vy/2, 'v₀'], {
  fontSize: 16,
  color: '#6366F1'
});

// Trajectory
var trajectory = board.create('functiongraph', [
  function(x) {
    if (x < 0) return null;
    var y = x * Math.tan(angle * Math.PI / 180) - (g * x * x) / (2 * vx * vx);
    return y < 0 ? null : y;
  }
], {
  strokeColor: '#2DD4BF',
  strokeWidth: 3
});

// Maximum height point
var maxX = (v0 * v0 * Math.sin(2 * angle * Math.PI / 180)) / (2 * g);
var maxY = (vy * vy) / (2 * g);

var maxPoint = board.create('point', [maxX/2, maxY], {
  name: 'Max Height',
  size: 3,
  fillColor: '#818CF8',
  strokeColor: '#818CF8'
});

// Range
var range = (v0 * v0 * Math.sin(2 * angle * Math.PI / 180)) / g;
var rangePoint = board.create('point', [range, 0], {
  name: 'Range',
  size: 3,
  fillColor: '#2DD4BF',
  strokeColor: '#2DD4BF'
});`,
      });
    },

    circleTheorem: async () => {
      return await DiagramGenerator.generate({
        type: 'geometry',
        topic: 'Circle with Tangent',
        difficulty: 65,
        content: `// Circle
var center = board.create('point', [0, 0], {
  name: 'O',
  size: 3,
  fillColor: '#6366F1',
  strokeColor: '#6366F1',
  fixed: true
});

var circle = board.create('circle', [center, 3], {
  strokeColor: '#6366F1',
  strokeWidth: 2,
  fillColor: 'rgba(99, 102, 241, 0.05)'
});

// Point on circle
var pointOnCircle = board.create('glider', [2, 2, circle], {
  name: 'P',
  size: 3,
  fillColor: '#2DD4BF',
  strokeColor: '#2DD4BF'
});

// Radius to point
var radius = board.create('segment', [center, pointOnCircle], {
  strokeColor: '#6366F1',
  strokeWidth: 2,
  dash: 1
});

board.create('text', [1, 1.2, 'r'], {
  fontSize: 16,
  color: '#6366F1'
});

// Tangent at point
var tangent = board.create('tangent', [pointOnCircle], {
  strokeColor: '#2DD4BF',
  strokeWidth: 2,
  dash: 2
});

// Right angle indicator
var angle = board.create('angle', [pointOnCircle, center, tangent.point1], {
  type: 'square',
  size: 0.5,
  fillColor: '#818CF8',
  strokeColor: '#818CF8'
});

board.create('text', [-4, 4, 'Radius ⊥ Tangent'], {
  fontSize: 14,
  color: '#dae2fd'
});`,
      });
    },
  },

  /**
   * 5. SmilesDrawer - Organic Chemistry
   * Model gives small SMILES string - minimal memory
   */
  smilesdrawer: {
    benzene: async () => {
      return await DiagramGenerator.generate({
        type: 'chemistry',
        topic: 'Benzene (C₆H₆)',
        difficulty: 50,
        content: 'c1ccccc1',
      });
    },

    aspirin: async () => {
      return await DiagramGenerator.generate({
        type: 'chemistry',
        topic: 'Aspirin (Acetylsalicylic Acid)',
        difficulty: 70,
        content: 'CC(=O)OC1=CC=CC=C1C(=O)O',
      });
    },

    glucose: async () => {
      return await DiagramGenerator.generate({
        type: 'chemistry',
        topic: 'Glucose (C₆H₁₂O₆)',
        difficulty: 60,
        content: 'C(C1C(C(C(C(O1)O)O)O)O)O',
      });
    },

    ethanol: async () => {
      return await DiagramGenerator.generate({
        type: 'chemistry',
        topic: 'Ethanol (C₂H₅OH)',
        difficulty: 30,
        content: 'CCO',
      });
    },

    caffeine: async () => {
      return await DiagramGenerator.generate({
        type: 'chemistry',
        topic: 'Caffeine',
        difficulty: 75,
        content: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',
      });
    },
  },

  /**
   * 6. Raw SVG - Biology Diagrams
   * Direct SVG - fastest, no external library
   */
  svg: {
    pulleySystem: async () => {
      return await DiagramGenerator.generate({
        type: 'physics',
        topic: 'Fixed Pulley System',
        difficulty: 60,
        content: `<svg viewBox="0 0 360 640" xmlns="http://www.w3.org/2000/svg">
  <!-- Support Beam -->
  <rect x="100" y="50" width="160" height="10" fill="#f3f4f6" stroke="#000000" stroke-width="2"/>
  <text x="180" y="40" text-anchor="middle" font-size="16">Rigid Support</text>
  
  <!-- Pulley Wheel -->
  <circle cx="180" cy="120" r="40" fill="#ffffff" stroke="#000000" stroke-width="2.5"/>
  <circle cx="180" cy="120" r="5" fill="#000000"/> <!-- Axle -->
  <line x1="180" y1="60" x2="180" y2="80" stroke="#000000" stroke-width="2"/> <!-- Hanger -->

  <!-- Rope going OVER the pulley -->
  <path d="M 140 250 L 140 120 A 40 40 0 0 1 220 120 L 220 350" fill="none" stroke="#000000" stroke-width="3"/>
  
  <!-- Mass 1 -->
  <rect x="120" y="250" width="40" height="40" fill="#ffffff" stroke="#0D9488" stroke-width="2"/>
  <text x="110" y="275" text-anchor="end" font-size="16">Load ($W_1$)</text>
  
  <!-- Mass 2 -->
  <rect x="200" y="350" width="40" height="60" fill="#ffffff" stroke="#4F46E5" stroke-width="2"/>
  <text x="250" y="385" text-anchor="start" font-size="16">Effort ($P$)</text>
  
  <!-- Force Arrows -->
  <path d="M 140 250 L 140 220" stroke="#000000" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="145" y="235" font-size="14">Tension ($T$)</text>
  
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
      <polygon points="0 0, 10 3, 0 6" fill="#000000"/>
    </marker>
  </defs>
</svg>`,
      });
    },

    animalCell: async () => {
      return await DiagramGenerator.generate({
        type: 'biology',
        topic: 'Animal Cell Structure',
        difficulty: 55,
        content: `<svg viewBox="0 0 360 640" xmlns="http://www.w3.org/2000/svg">
  <!-- Cell Membrane -->
  <ellipse cx="180" cy="300" rx="150" ry="200" fill="none" stroke="#000000" stroke-width="2"/>
  <text x="180" y="80" text-anchor="middle" font-size="18" font-weight="bold">Animal Cell</text>
  
  <!-- Nucleus -->
  <circle cx="180" cy="300" r="50" fill="#f9fafb" stroke="#0D9488" stroke-width="2"/>
  <text x="180" y="305" text-anchor="middle" font-size="14">Nucleus</text>
  
  <!-- Mitochondria -->
  <ellipse cx="100" cy="250" rx="30" ry="15" fill="none" stroke="#4F46E5" stroke-width="2" transform="rotate(-30 100 250)"/>
  <text x="50" y="230" text-anchor="end" font-size="14">Mitochondria</text>
  
  <!-- Golgi Body -->
  <path d="M 230 350 Q 250 340 270 350 M 230 360 Q 250 350 270 360" fill="none" stroke="#000000" stroke-width="2"/>
  <text x="280" y="360" text-anchor="start" font-size="14">Golgi Body</text>
  
  <!-- Cytoplasm label -->
  <text x="260" y="200" text-anchor="start" font-size="14" fill="#6b7280">Cytoplasm</text>
</svg>`,
      });
    },
  },
};

/**
 * Test all diagram types
 */
export async function testAllDiagrams() {
  console.log('🧪 Testing all 4 core diagram libraries...\n');

  const results = {
    katex: null as any,
    jsxgraph: null as any,
    smilesdrawer: null as any,
    svg: null as any,
  };

  try {
    // 1. KaTeX
    console.log('1️⃣ Testing KaTeX...');
    results.katex = await DiagramExamples.katex.escapeVelocity();
    console.log('✅ KaTeX working!\n');

    // 2. JSXGraph
    console.log('2️⃣ Testing JSXGraph...');
    results.jsxgraph = await DiagramExamples.jsxgraph.projectileMotion();
    console.log('✅ JSXGraph working!\n');

    // 3. SmilesDrawer
    console.log('3️⃣ Testing SmilesDrawer...');
    results.smilesdrawer = await DiagramExamples.smilesdrawer.benzene();
    console.log('✅ SmilesDrawer working!\n');

    // 4. Raw SVG
    console.log('4️⃣ Testing Raw SVG...');
    results.svg = await DiagramExamples.svg.animalCell();
    console.log('✅ Raw SVG working!\n');

    console.log('🎉 All 4 core libraries tested successfully!');
    return results;
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}
