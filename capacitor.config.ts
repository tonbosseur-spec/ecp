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
      overlaysWebView: false,
      backgroundColor: '#16a34a',
      style: 'LIGHT'
    }
  }
};

export default config;
