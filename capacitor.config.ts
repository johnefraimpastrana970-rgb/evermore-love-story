import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.evermore.lovestory',
  appName: 'Evermore',
  webDir: 'dist',
  backgroundColor: '#1d1527',
  android: {
    allowMixedContent: false,
  },
};

export default config;
