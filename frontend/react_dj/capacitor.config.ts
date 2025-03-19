import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aico.music',
  appName: 'AICO',
  webDir: 'build',
  server: {
    androidScheme: 'http',
    iosScheme: 'http',
    hostname: 'aico-music.com',
    url: 'http://aico-music.com'
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: true,
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true
  }
};

export default config;
