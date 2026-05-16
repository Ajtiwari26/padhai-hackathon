#!/bin/bash

# Build and Test Script for Hackathon Demo
# Run this to build the app and verify all fixes are working

echo "🚀 Padh.ai Hackathon Build & Test Script"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Clean build
echo "📦 Step 1: Clean Build"
echo "----------------------"
cd android
echo "Cleaning Android build..."
./gradlew clean
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Clean successful${NC}"
else
    echo -e "${RED}❌ Clean failed${NC}"
    exit 1
fi
cd ..

echo ""
echo "🔨 Building app..."
npx react-native run-android
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo ""
echo "✅ Build Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Open the app on your device"
echo "2. Start a conversation"
echo "3. Monitor logs with: adb logcat | grep -E 'ModelManager|ContextBudget|LocalServerManager'"
echo "4. Test for 30 minutes to verify stability"
echo ""
echo "🧪 Testing Checklist:"
echo "  [ ] Caveman mode: Type '/caveman on' → Should not work"
echo "  [ ] Memory: Check logs every 10 seconds for memory stats"
echo "  [ ] Thermal: Check logs before each inference"
echo "  [ ] Context: Verify 'Safe max tokens: 8192' in logs"
echo "  [ ] Auto-pause: Wait 60s idle → Check for '💤 Auto-pausing' in logs"
echo ""
echo "🎬 Demo Preparation:"
echo "  [ ] Rehearse demo script 3 times"
echo "  [ ] Record backup video"
echo "  [ ] Charge devices to 100%"
echo "  [ ] Test on 2 devices (backup)"
echo ""
echo "🎉 You're ready for the hackathon!"
echo ""
