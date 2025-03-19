#!/bin/bash

# Script to build and prepare the iOS app

echo "===== Building AICO Music iOS App ====="

# Step 1: Install dependencies
echo "Installing dependencies..."
npm install

# Step 2: Build the React app
echo "Building React app..."
npm run build

# Step 3: Sync Capacitor project
echo "Syncing Capacitor project..."
npx cap sync

# Step 4: Instructions for opening in Xcode
echo ""
echo "===== iOS Build Preparation Complete ====="
echo ""
echo "To complete the iOS build process:"
echo "1. Transfer this project to a macOS computer"
echo "2. Install CocoaPods if not already installed: sudo gem install cocoapods"
echo "3. Navigate to the ios/App directory and run: pod install"
echo "4. Open the project in Xcode: npx cap open ios"
echo "5. Configure signing with your Apple Developer account"
echo "6. IMPORTANT: Configure App Transport Security (ATS) in Info.plist to allow HTTP connections"
echo "   (See ios-build-instructions.md for details)"
echo "7. Build and run the app on a simulator or device"
echo ""
echo "For detailed instructions, please refer to ios-build-instructions.md"
