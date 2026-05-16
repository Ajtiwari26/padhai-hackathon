/**
 * Generate App Icons
 * 
 * Creates PNG icons for iOS and Android using Canvas
 * Run: node generate_app_icons.js
 */

const fs = require('fs');
const { createCanvas } = require('canvas');

// Icon sizes needed
const sizes = {
  ios: [
    { size: 1024, name: 'ios-1024.png', path: 'ios/PadhAI/Images.xcassets/AppIcon.appiconset/icon-1024.png' },
    { size: 180, name: 'ios-180.png', path: 'ios/PadhAI/Images.xcassets/AppIcon.appiconset/icon-180.png' },
    { size: 167, name: 'ios-167.png', path: 'ios/PadhAI/Images.xcassets/AppIcon.appiconset/icon-167.png' },
    { size: 152, name: 'ios-152.png', path: 'ios/PadhAI/Images.xcassets/AppIcon.appiconset/icon-152.png' },
    { size: 120, name: 'ios-120.png', path: 'ios/PadhAI/Images.xcassets/AppIcon.appiconset/icon-120.png' },
    { size: 87, name: 'ios-87.png', path: 'ios/PadhAI/Images.xcassets/AppIcon.appiconset/icon-87.png' },
    { size: 80, name: 'ios-80.png', path: 'ios/PadhAI/Images.xcassets/AppIcon.appiconset/icon-80.png' },
    { size: 76, name: 'ios-76.png', path: 'ios/PadhAI/Images.xcassets/AppIcon.appiconset/icon-76.png' },
    { size: 60, name: 'ios-60.png', path: 'ios/PadhAI/Images.xcassets/AppIcon.appiconset/icon-60.png' },
    { size: 58, name: 'ios-58.png', path: 'ios/PadhAI/Images.xcassets/AppIcon.appiconset/icon-58.png' },
    { size: 40, name: 'ios-40.png', path: 'ios/PadhAI/Images.xcassets/AppIcon.appiconset/icon-40.png' },
    { size: 29, name: 'ios-29.png', path: 'ios/PadhAI/Images.xcassets/AppIcon.appiconset/icon-29.png' },
    { size: 20, name: 'ios-20.png', path: 'ios/PadhAI/Images.xcassets/AppIcon.appiconset/icon-20.png' },
  ],
  android: [
    { size: 192, name: 'ic_launcher.png', path: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png' },
    { size: 144, name: 'ic_launcher.png', path: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png' },
    { size: 96, name: 'ic_launcher.png', path: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png' },
    { size: 72, name: 'ic_launcher.png', path: 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png' },
    { size: 48, name: 'ic_launcher.png', path: 'android/app/src/main/res/mipmap-mdpi/ic_launcher.png' },
  ]
};

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  const scale = size / 1024;
  
  // Background - Midnight Blue
  ctx.fillStyle = '#0b1326';
  ctx.fillRect(0, 0, size, size);
  
  const centerX = size / 2;
  const centerY = size / 2;
  const chipSize = 480 * scale;
  const chipRadius = 100 * scale;
  
  // Outer Glow (multiple layers)
  for (let i = 5; i > 0; i--) {
    const glowSize = chipSize + (i * 40 * scale);
    const glowAlpha = 0.05 * i;
    
    ctx.fillStyle = `rgba(99, 102, 241, ${glowAlpha * 0.3})`;
    roundRect(ctx, centerX - glowSize/2, centerY - glowSize/2, glowSize, glowSize, chipRadius);
    ctx.fill();
  }
  
  // Chip Core - Deep Purple
  const gradient = ctx.createLinearGradient(
    centerX - chipSize/2, centerY - chipSize/2,
    centerX + chipSize/2, centerY + chipSize/2
  );
  gradient.addColorStop(0, '#5B21B6');
  gradient.addColorStop(0.5, '#6D28D9');
  gradient.addColorStop(1, '#5B21B6');
  
  ctx.fillStyle = gradient;
  roundRect(ctx, centerX - chipSize/2, centerY - chipSize/2, chipSize, chipSize, chipRadius);
  ctx.fill();
  
  // Chip Border
  ctx.strokeStyle = '#7C3AED';
  ctx.lineWidth = 8 * scale;
  ctx.stroke();
  
  // Inner Glow
  ctx.fillStyle = 'rgba(124, 58, 237, 0.3)';
  roundRect(ctx, centerX - chipSize/2, centerY - chipSize/2, chipSize, chipSize, chipRadius);
  ctx.fill();
  
  // Internal Circuitry - Horizontal
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.5)';
  ctx.lineWidth = 3 * scale;
  
  const circuitY = [0.20, 0.35, 0.50, 0.65, 0.80];
  const circuitW = [0.70, 0.85, 0.60, 0.75, 0.65];
  
  circuitY.forEach((y, i) => {
    const startX = centerX - (chipSize * circuitW[i]) / 2;
    const endX = centerX + (chipSize * circuitW[i]) / 2;
    const lineY = centerY - chipSize/2 + (chipSize * y);
    
    ctx.beginPath();
    ctx.moveTo(startX, lineY);
    ctx.lineTo(endX, lineY);
    ctx.stroke();
  });
  
  // Internal Circuitry - Vertical
  const circuitX = [0.20, 0.40, 0.60, 0.80];
  const circuitH = [0.70, 0.55, 0.65, 0.60];
  
  circuitX.forEach((x, i) => {
    const lineX = centerX - chipSize/2 + (chipSize * x);
    const startY = centerY - (chipSize * circuitH[i]) / 2;
    const endY = centerY + (chipSize * circuitH[i]) / 2;
    
    ctx.beginPath();
    ctx.moveTo(lineX, startY);
    ctx.lineTo(lineX, endY);
    ctx.stroke();
  });
  
  // Central Processor Core
  const processorSize = 140 * scale;
  const processorRadius = 20 * scale;
  
  ctx.fillStyle = '#1E1B4B';
  roundRect(ctx, centerX - processorSize/2, centerY - processorSize/2, processorSize, processorSize, processorRadius);
  ctx.fill();
  
  ctx.strokeStyle = '#2DD4BF';
  ctx.lineWidth = 6 * scale;
  ctx.stroke();
  
  // Processor Dot
  const dotSize = 40 * scale;
  ctx.fillStyle = '#2DD4BF';
  ctx.beginPath();
  ctx.arc(centerX, centerY, dotSize/2, 0, Math.PI * 2);
  ctx.fill();
  
  // Corner Accents
  const accentSize = 20 * scale;
  const accentOffset = 40 * scale;
  const accentRadius = 4 * scale;
  
  ctx.fillStyle = 'rgba(45, 212, 191, 0.7)';
  
  // Four corners
  roundRect(ctx, centerX - chipSize/2 + accentOffset, centerY - chipSize/2 + accentOffset, accentSize, accentSize, accentRadius);
  ctx.fill();
  roundRect(ctx, centerX + chipSize/2 - accentOffset - accentSize, centerY - chipSize/2 + accentOffset, accentSize, accentSize, accentRadius);
  ctx.fill();
  roundRect(ctx, centerX - chipSize/2 + accentOffset, centerY + chipSize/2 - accentOffset - accentSize, accentSize, accentSize, accentRadius);
  ctx.fill();
  roundRect(ctx, centerX + chipSize/2 - accentOffset - accentSize, centerY + chipSize/2 - accentOffset - accentSize, accentSize, accentSize, accentRadius);
  ctx.fill();
  
  // Triodes
  const triodeWidth = 30 * scale;
  const triodeLength = 120 * scale;
  const triodeRadius = 15 * scale;
  
  ctx.fillStyle = '#2DD4BF';
  
  // Top
  roundRect(ctx, centerX - triodeWidth/2, centerY - chipSize/2 - triodeLength, triodeWidth, triodeLength, triodeRadius);
  ctx.fill();
  
  // Bottom
  roundRect(ctx, centerX - triodeWidth/2, centerY + chipSize/2, triodeWidth, triodeLength, triodeRadius);
  ctx.fill();
  
  // Right
  roundRect(ctx, centerX + chipSize/2, centerY - triodeWidth/2, triodeLength, triodeWidth, triodeRadius);
  ctx.fill();
  
  return canvas;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Generate all icons
console.log('🎨 Generating app icons...\n');

// iOS icons
console.log('📱 iOS Icons:');
sizes.ios.forEach(({ size, name, path }) => {
  const canvas = drawIcon(size);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path, buffer);
  console.log(`  ✅ ${name} (${size}x${size})`);
});

// Android icons
console.log('\n🤖 Android Icons:');
sizes.android.forEach(({ size, name, path }) => {
  const canvas = drawIcon(size);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path, buffer);
  console.log(`  ✅ ${name} (${size}x${size})`);
});

console.log('\n✨ All icons generated successfully!');
console.log('\n📍 Locations:');
console.log('  iOS: ios/PadhAI/Images.xcassets/AppIcon.appiconset/');
console.log('  Android: android/app/src/main/res/mipmap-*/');
