import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Run in the Garden - Capacitor configuration
 *
 * The appId below is GOOGLE'S OFFICIAL TEST APP ID.
 * Replace it with your real AdMob app ID (from the AdMob console)
 * ONLY when you switch from test ads to production ads.
 */
const config: CapacitorConfig = {
  appId: 'com.gardenstudio.runinthegarden',
  appName: 'Run in the Garden',
  webDir: 'www',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false
  },
  plugins: {
    AdMob: {
      // Google's official TEST app ID - safe for development and QA
      appId: 'ca-app-pub-3940256099942544~3347511713',
      initializeForTesting: true,
      maxAdContentRating: 'G',
      tagForChildDirectedTreatment: true,
      tagForUnderAgeOfConsent: true
    }
  }
};

export default config;
