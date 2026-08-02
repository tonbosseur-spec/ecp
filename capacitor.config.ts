import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.excellerchezpierre.app',
  appName: 'ECP Apprenant',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'LIGHT'
    }
  }
};

export default config;
