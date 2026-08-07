import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

const WEB_BIOMETRIC_KEY = 'ecp_web_biometric_credentials_v1';

export interface BiometricStatus {
  isAvailable: boolean;
  hasCredentialsSaved: boolean;
  type: 'native' | 'web' | 'none';
}

interface WebStoredCred {
  email: string;
  pass: string;
  credId?: string;
}

function getWebStoredCredential(): WebStoredCred | null {
  try {
    const raw = localStorage.getItem(WEB_BIOMETRIC_KEY);
    if (!raw) return null;
    const decoded = atob(raw);
    const parsed = JSON.parse(decoded);
    if (parsed && parsed.email && parsed.pass) {
      return parsed;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function saveWebCredential(email: string, pass: string, credId?: string) {
  try {
    const data: WebStoredCred = { email, pass, credId };
    const encoded = btoa(JSON.stringify(data));
    localStorage.setItem(WEB_BIOMETRIC_KEY, encoded);
  } catch (e) {
    console.error('Error saving web biometric credentials:', e);
  }
}

export function clearWebCredential() {
  try {
    localStorage.removeItem(WEB_BIOMETRIC_KEY);
  } catch (e) {}
}

/**
 * Checks if Biometrics (Touch ID / Face ID / Windows Hello / Fingerprint) are supported
 * on either Native Mobile or Web Browser.
 */
export async function checkBiometricStatus(): Promise<BiometricStatus> {
  // 1. Native Mobile Platform
  if (Capacitor.isNativePlatform()) {
    try {
      const avail = await NativeBiometric.isAvailable();
      if (avail.isAvailable) {
        const saved = await NativeBiometric.isCredentialsSaved({ server: 'admin_ecp' });
        return {
          isAvailable: true,
          hasCredentialsSaved: saved.isSaved,
          type: 'native',
        };
      }
    } catch (e) {
      console.warn('Native biometric availability check failed:', e);
    }
  }

  // 2. Web Browser Platform (WebAuthn / Touch ID / Face ID / Fingerprint / Windows Hello)
  if (typeof window !== 'undefined' && 'PublicKeyCredential' in window) {
    try {
      let isAvailable = false;
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } else {
        isAvailable = true; // Fallback if WebAuthn API present
      }

      const stored = getWebStoredCredential();
      return {
        isAvailable: isAvailable,
        hasCredentialsSaved: !!stored,
        type: 'web',
      };
    } catch (e) {
      console.warn('WebAuthn availability check failed:', e);
    }
  }

  return {
    isAvailable: false,
    hasCredentialsSaved: false,
    type: 'none',
  };
}

/**
 * Saves biometric credentials after a successful password login.
 */
export async function saveBiometricCredentials(email: string, password: string): Promise<boolean> {
  // 1. Native Mobile Platform
  if (Capacitor.isNativePlatform()) {
    try {
      const avail = await NativeBiometric.isAvailable();
      if (avail.isAvailable) {
        await NativeBiometric.setCredentials({
          server: 'admin_ecp',
          username: email,
          password: password,
        });
        return true;
      }
    } catch (e) {
      console.error('Failed to set native biometric credentials:', e);
    }
    return false;
  }

  // 2. Web Browser Platform
  if (typeof window !== 'undefined' && 'PublicKeyCredential' in window) {
    let credId: string | undefined = undefined;

    // Try WebAuthn Passkey / Biometric registration prompt if available
    if (navigator.credentials && typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const userId = new Uint8Array(16);
        window.crypto.getRandomValues(userId);

        const rpHost = window.location.hostname || 'localhost';

        const credential = (await navigator.credentials.create({
          publicKey: {
            challenge: challenge,
            rp: {
              name: 'ecpmanager Admin',
              id: rpHost === 'localhost' ? undefined : rpHost,
            },
            user: {
              id: userId,
              name: email,
              displayName: email,
            },
            pubKeyCredParams: [
              { type: 'public-key', alg: -7 }, // ES256
              { type: 'public-key', alg: -257 }, // RS256
            ],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
            },
            timeout: 60000,
          },
        })) as any;

        if (credential?.id) {
          credId = credential.id;
        }
      } catch (e: any) {
        console.info('WebAuthn credential registration notice:', e);
      }
    }

    saveWebCredential(email, password, credId);
    return true;
  }

  return false;
}

/**
 * Performs Biometric Verification and returns stored credentials.
 */
export async function authenticateWithBiometrics(): Promise<{ email: string; password: string }> {
  // 1. Native Mobile Platform
  if (Capacitor.isNativePlatform()) {
    await NativeBiometric.verifyIdentity({
      reason: 'Connectez-vous à votre compte administrateur',
      title: 'Connexion biométrique',
    });
    const credentials = await NativeBiometric.getCredentials({
      server: 'admin_ecp',
    });
    return {
      email: credentials.username,
      password: credentials.password,
    };
  }

  // 2. Web Browser Platform
  if (typeof window !== 'undefined' && 'PublicKeyCredential' in window) {
    const creds = getWebStoredCredential();
    if (!creds) {
      throw new Error('Aucune donnée biométrique enregistrée sur ce navigateur.');
    }

    // Trigger WebAuthn browser Touch ID / Face ID / Windows Hello prompt
    if (navigator.credentials) {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const rpHost = window.location.hostname || 'localhost';

      try {
        const options: PublicKeyCredentialRequestOptions = {
          challenge: challenge,
          timeout: 60000,
          userVerification: 'required',
          rpId: rpHost === 'localhost' ? undefined : rpHost,
        };

        await navigator.credentials.get({ publicKey: options });
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          throw new Error('Authentification biométrique annulée par l\'utilisateur.');
        }
        console.warn('WebAuthn authentication prompt notice:', err);
      }
    }

    return {
      email: creds.email,
      password: creds.pass,
    };
  }

  throw new Error('La biométrie n\'est pas supportée sur ce navigateur.');
}
