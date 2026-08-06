import { PushNotifications, PermissionStatus } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabaseClient';
import { playNotificationSound, triggerWebPushNotification } from '../components/NotificationBell';

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

/**
 * Configure FCM Android notification channel for Capacitor Push Notifications
 */
export async function setupFCMNotificationChannel() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Create high-importance channel for Android 8+
    await PushNotifications.createChannel({
      id: 'default',
      name: 'Notifications Générales',
      description: 'Notifications pour les cours, lives et messages',
      importance: 5, // High importance (sound, heads-up display)
      visibility: 1,  // Public
      sound: 'default',
      vibration: true,
    });
  } catch (err) {
    console.warn('[FCM Setup] Failed to create notification channel:', err);
  }
}

/**
 * Register native Push Notifications and return the FCM device token
 */
export async function registerNativePushNotifications(userId?: string): Promise<{ token: string | null; error: string | null }> {
  if (!Capacitor.isNativePlatform()) {
    return { token: null, error: 'Push notifications require a native APK environment.' };
  }

  try {
    await setupFCMNotificationChannel();

    let permStatus: PermissionStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive !== 'granted') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      return { token: null, error: 'Permission de notification refusée sur cet appareil.' };
    }

    await PushNotifications.register();

    return new Promise((resolve) => {
      // Listener for token registration
      PushNotifications.addListener('registration', async (token) => {
        const deviceToken = token.value;
        console.log('[FCM Push] Device Token Registered:', deviceToken);

        if (userId) {
          try {
            await supabase
              .from('client_profiles')
              .update({
                fcm_token: deviceToken,
                expo_push_token: deviceToken,
                updated_at: new Date().toISOString(),
              } as any)
              .eq('id', userId);
          } catch (dbErr) {
            console.warn('[FCM Push] Failed to update user token in database:', dbErr);
          }
        }

        resolve({ token: deviceToken, error: null });
      });

      // Listener for registration error
      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('[FCM Push] Registration Error:', error);
        resolve({ token: null, error: error?.error || "Erreur d'enregistrement auprès du service FCM" });
      });
    });
  } catch (err: any) {
    console.error('[FCM Push] Exception during registration:', err);
    return { token: null, error: err.message || 'Impossible d’initialiser les notifications push native' };
  }
}

/**
 * Listen for incoming foreground push notifications & user notification clicks
 */
export function initPushNotificationListeners(
  onNotificationReceived?: (notification: any) => void,
  onNotificationAction?: (action: any) => void
) {
  if (!Capacitor.isNativePlatform()) return () => {};

  // 1. Received while app is in foreground
  const receivedListener = PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[FCM Push] Notification reçue (Foreground):', notification);
    playNotificationSound();

    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  // 2. User tapped on notification in notification bar
  const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('[FCM Push] Notification cliquée (Action):', action);
    const data = action.notification.data;

    if (onNotificationAction) {
      onNotificationAction(action);
    } else if (data?.url) {
      window.location.href = data.url;
    }
  });

  return () => {
    receivedListener.then((l) => l.remove());
    actionListener.then((l) => l.remove());
  };
}

/**
 * Helper: Convert URL string/ArrayBuffer to Base64Url
 */
function base64UrlEncode(strOrBuffer: string | ArrayBuffer): string {
  let base64 = '';
  if (typeof strOrBuffer === 'string') {
    base64 = btoa(unescape(encodeURIComponent(strOrBuffer)));
  } else {
    const bytes = new Uint8Array(strOrBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Helper: Convert PEM PKCS8 key to binary ArrayBuffer
 */
function pemToBinary(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate a Google OAuth2 Access Token for FCM HTTP v1 using a Google Service Account JSON
 */
export async function getAccessTokenFromServiceAccount(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
  const unsignedToken = `${encodedHeader}.${encodedClaimSet}`;

  const binaryKey = pemToBinary(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const jwt = `${unsignedToken}.${base64UrlEncode(signature)}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Impossible d’obtenir le jeton OAuth2 FCM');
  }

  return data.access_token;
}

/**
 * Send a Push Notification to a single FCM device token using FCM HTTP v1 API
 */
export async function sendPushNotificationToToken(
  fcmToken: string,
  payload: PushMessagePayload,
  configOverride?: FCMConfig
): Promise<{ success: boolean; error?: string }> {
  if (!fcmToken) {
    return { success: false, error: 'Jeton FCM manquant pour l’utilisateur destinataire.' };
  }

  const projectId = configOverride?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ecpmanager';

  // 1. Resolve OAuth2 Bearer Token for FCM HTTP v1
  let accessToken = configOverride?.bearerToken || import.meta.env.VITE_FCM_BEARER_TOKEN || localStorage.getItem('fcm_bearer_token');

  if (!accessToken) {
    // Check for Service Account JSON key
    const saStr = configOverride?.serviceAccountJson || import.meta.env.VITE_FIREBASE_SERVICE_ACCOUNT || localStorage.getItem('fcm_service_account');
    if (saStr) {
      try {
        const saObj = typeof saStr === 'string' ? JSON.parse(saStr) : saStr;
        if (saObj.client_email && saObj.private_key) {
          accessToken = await getAccessTokenFromServiceAccount(saObj);
        }
      } catch (e: any) {
        console.warn('[FCM v1] Error generating token from Service Account:', e);
      }
    }
  }

  // Fallback to legacy server key if legacy key is present and no v1 token found
  if (!accessToken) {
    const legacyKey = import.meta.env.VITE_FCM_SERVER_KEY;
    if (legacyKey) {
      try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${legacyKey}`,
          },
          body: JSON.stringify({
            to: fcmToken,
            notification: {
              title: payload.title,
              body: payload.body,
              sound: 'default',
            },
            data: { url: payload.url || '/client/hub', ...(payload.data || {}) },
            priority: 'high',
          }),
        });

        const result = await response.json();
        if (response.ok && result.success > 0) return { success: true };
      } catch (e) {
        console.warn('[FCM Legacy Fallback error]:', e);
      }
    }

    return {
      success: false,
      error: "Clé FCM HTTP v1 manquante. Veuillez renseigner le compte de service (Service Account JSON) ou le jeton Bearer dans la fenêtre d'administration des notifications.",
    };
  }

  // 2. Execute FCM HTTP v1 Request
  try {
    const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: {
            url: payload.url || '/client/hub',
            ...(payload.data ? Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, String(v)])) : {}),
          },
          android: {
            priority: 'HIGH',
            notification: {
              sound: 'default',
              channel_id: 'default',
              icon: 'ic_launcher',
              color: '#2563EB',
            },
          },
        },
      }),
    });

    const result = await response.json();
    if (response.ok && result.name) {
      return { success: true };
    } else {
      console.error('[FCM HTTP v1 Send Error]:', result);
      return {
        success: false,
        error: result.error?.message || 'Erreur FCM HTTP v1 lors de l’envoi au serveur Google.',
      };
    }
  } catch (err: any) {
    console.error('[FCM HTTP v1 Network Exception]:', err);
    return { success: false, error: err.message || 'Erreur réseau lors de l’envoi FCM HTTP v1' };
  }
}

/**
 * Send Push Notification to a user by ID (retrieves fcm_token from database)
 */
export async function sendPushNotificationToUser(
  userId: string,
  payload: PushMessagePayload,
  configOverride?: FCMConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: profile, error } = await supabase
      .from('client_profiles')
      .select('fcm_token')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile?.fcm_token) {
      return { success: false, error: 'Aucun jeton de notification FCM enregistré pour cet utilisateur.' };
    }

    return await sendPushNotificationToToken(profile.fcm_token, payload, configOverride);
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Broadcast Push Notification to all users registered with an FCM token
 */
export async function broadcastPushNotification(
  payload: PushMessagePayload,
  configOverride?: FCMConfig
): Promise<{ successCount: number; failureCount: number; total: number }> {
  try {
    const { data: profiles, error } = await supabase
      .from('client_profiles')
      .select('fcm_token')
      .not('fcm_token', 'is', null);

    if (error || !profiles || profiles.length === 0) {
      return { successCount: 0, failureCount: 0, total: 0 };
    }

    let successCount = 0;
    let failureCount = 0;

    for (const p of profiles) {
      if (p.fcm_token) {
        const res = await sendPushNotificationToToken(p.fcm_token, payload, configOverride);
        if (res.success) successCount++;
        else failureCount++;
      }
    }

    return { successCount, failureCount, total: profiles.length };
  } catch (err) {
    console.error('[FCM Broadcast Error]:', err);
    return { successCount: 0, failureCount: 0, total: 0 };
  }
}

