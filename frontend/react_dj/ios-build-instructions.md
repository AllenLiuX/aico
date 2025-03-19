# AICO Music iOS App Build Instructions

This document provides instructions on how to build and run the AICO Music iOS app using Capacitor.

## Prerequisites

- macOS computer (required for iOS development)
- Xcode 12 or higher installed
- Apple Developer account
- CocoaPods installed (`sudo gem install cocoapods`)
- Node.js and npm installed

## Setup Instructions

1. Clone the repository to your macOS machine
2. Navigate to the project directory:
   ```
   cd /path/to/aico/frontend/react_dj
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Build the React app:
   ```
   npm run build
   ```

5. Sync the Capacitor project:
   ```
   npx cap sync
   ```

6. Open the iOS project in Xcode:
   ```
   npx cap open ios
   ```

## Configuring the iOS App

1. In Xcode, select the "App" project in the Project Navigator
2. Select the "App" target
3. Go to the "Signing & Capabilities" tab
4. Sign in with your Apple Developer account
5. Select your Team
6. Update the Bundle Identifier if needed (default is `com.aico.music`)

## App Transport Security Configuration (Important)

Since the app connects to an HTTP server (http://aico-music.com), you need to configure App Transport Security (ATS) to allow non-secure connections:

1. In Xcode, open the `Info.plist` file in the App/App folder
2. Add the following configuration:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
    <key>NSExceptionDomains</key>
    <dict>
        <key>aico-music.com</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
            <key>NSIncludesSubdomains</key>
            <true/>
        </dict>
    </dict>
</dict>
```

**Note:** For App Store submission, Apple may require justification for using HTTP instead of HTTPS. Consider migrating to HTTPS for production deployment.

## Building and Running the App

1. Select a simulator or connected device from the device dropdown
2. Click the "Play" button to build and run the app

## Troubleshooting

- If you encounter build errors related to CocoaPods, try running:
  ```
  cd ios/App
  pod install
  ```

- If you need to update the web content after making changes:
  ```
  npm run build
  npx cap copy ios
  ```

## Distributing the App

To distribute the app to TestFlight or the App Store:

1. In Xcode, select "Product" > "Archive"
2. Once the archive is complete, click "Distribute App"
3. Follow the prompts to upload to App Store Connect

## Additional Resources

- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [TestFlight Beta Testing](https://developer.apple.com/testflight/)
