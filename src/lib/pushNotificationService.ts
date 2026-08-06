// Notifications push FCM complètement désactivées à la demande de l'utilisateur

export interface PushMessagePayload {
  title: string;
  body: string;
  url?: string;
  data?: Record<string, any>;
}

export interface FCMConfig {
  projectId?: string;
  bearerToken?: string;
  serviceAccountJson?: string;
}

export async function setupFCMNotificationChannel() {
  return;
}

export async function registerNativePushNotifications(_userId?: string): Promise<{ token: string | null; error: string | null }> {
  return { token: null, error: null };
}

export function initPushNotificationListeners(
  _onNotificationReceived?: (notification: any) => void,
  _onNotificationAction?: (action: any) => void
) {
  return () => {};
}

export async function sendPushNotificationToToken(
  _fcmToken: string,
  _payload: PushMessagePayload,
  _configOverride?: FCMConfig
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return { success: false, error: 'Notifications push désactivées.' };
}

export async function sendPushNotificationToUser(
  _userId: string,
  _payload: PushMessagePayload,
  _configOverride?: FCMConfig
): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Notifications push désactivées.' };
}

export async function broadcastPushNotification(
  _payload: PushMessagePayload,
  _configOverride?: FCMConfig
): Promise<{ total: number; sent: number; failed: number }> {
  return { total: 0, sent: 0, failed: 0 };
}
