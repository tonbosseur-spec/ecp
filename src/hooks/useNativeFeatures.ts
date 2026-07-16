import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '../lib/supabaseClient';

export interface UseNativeFeaturesResult {
  takeOrSelectPhoto: (options?: { source?: 'CAMERA' | 'PHOTOS' | 'PROMPT'; maxKB?: number }) => Promise<{ url: string | null; error: string | null }>;
  registerPushNotifications: (userId: string) => Promise<{ token: string | null; error: string | null }>;
  isNative: boolean;
  pushToken: string | null;
}

export function useNativeFeatures(): UseNativeFeaturesResult {
  const navigate = useNavigate();
  const location = useLocation();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [isNative, setIsNative] = useState<boolean>(false);

  // Detect native environment (Capacitor runs on native platforms)
  useEffect(() => {
    const isCapacitor = (window as any).Capacitor !== undefined;
    setIsNative(isCapacitor);
  }, []);

  // A. Back Button Handler
  useEffect(() => {
    let handler: any = null;

    const setupBackButton = async () => {
      try {
        handler = await App.addListener('backButton', ({ canGoBack }) => {
          const currentPath = location.pathname;
          
          // Landing Pages / Hubs or if we can't go back in routing history
          const isMainPage = currentPath === '/' || currentPath === '/client/hub' || currentPath === '/dashboard';
          
          if (isMainPage || !canGoBack) {
            // Minimize the app cleanly instead of exiting brutally
            App.minimizeApp();
          } else {
            // Go back in react-router-dom history
            navigate(-1);
          }
        });
      } catch (err) {
        console.warn('Physical back button handling not available on Web:', err);
      }
    };

    setupBackButton();

    return () => {
      if (handler) {
        handler.remove();
      }
    };
  }, [location.pathname, navigate]);

  // B. Helper: Compress Base64 Image using HTML Canvas to max size (default 200 KB)
  const compressImage = (base64Str: string, maxBytes: number = 200 * 1024): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = `data:image/jpeg;base64,${base64Str}`;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Scale down if dimensions are huge
        const MAX_DIM = 1200;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Impossible de créer le contexte 2D du Canvas"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Iteratively compress quality to be under maxBytes
        let quality = 0.85;
        const attemptCompression = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Erreur de compression d'image"));
                return;
              }
              if (blob.size <= maxBytes || quality <= 0.1) {
                resolve(blob);
              } else {
                quality -= 0.15;
                attemptCompression();
              }
            },
            'image/jpeg',
            quality
          );
        };

        attemptCompression();
      };
      img.onerror = (err) => reject(err);
    });
  };

  // Take or select photo, compress it, upload to Supabase, and return public URL
  const takeOrSelectPhoto = async (options?: {
    source?: 'CAMERA' | 'PHOTOS' | 'PROMPT';
    maxKB?: number;
  }): Promise<{ url: string | null; error: string | null }> => {
    const sourceParam = options?.source || 'PROMPT';
    const maxKB = options?.maxKB || 200;
    const maxBytes = maxKB * 1024;

    try {
      // 1. Request permissions (Camera and photos)
      let permissions;
      try {
        permissions = await Camera.requestPermissions();
      } catch (err) {
        console.warn('Camera requestPermissions not supported on web:', err);
      }

      // Map prompt source
      let cameraSource = CameraSource.Prompt;
      if (sourceParam === 'CAMERA') cameraSource = CameraSource.Camera;
      if (sourceParam === 'PHOTOS') cameraSource = CameraSource.Photos;

      // 2. Open camera/gallery
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: cameraSource,
      });

      if (!photo.base64String) {
        return { url: null, error: "Aucune donnée d'image récupérée." };
      }

      // 3. Compress the image to under specified size
      const compressedBlob = await compressImage(photo.base64String, maxBytes);

      // 4. Upload to Supabase Storage in "course-images" bucket
      const fileExt = 'jpg';
      const fileName = `native_uploads/${Date.now()}_${Math.floor(Math.random() * 100000)}.${fileExt}`;
      
      const { data, error: uploadError } = await supabase.storage
        .from('course-images')
        .upload(fileName, compressedBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // 5. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('course-images')
        .getPublicUrl(fileName);

      return { url: publicUrl, error: null };
    } catch (err: any) {
      console.error("Erreur takeOrSelectPhoto :", err);
      return { url: null, error: err.message || "Échec de la capture ou de l'upload de l'image" };
    }
  };

  // C. Push Notifications Registration
  const registerPushNotifications = async (userId: string): Promise<{ token: string | null; error: string | null }> => {
    try {
      // Check permissions
      let permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive !== 'granted') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        return { token: null, error: "Permissions de notifications refusées" };
      }

      // Register with FCM
      await PushNotifications.register();

      return new Promise((resolve) => {
        // Handle successful registration and get device token
        PushNotifications.addListener('registration', async (token) => {
          const deviceToken = token.value;
          setPushToken(deviceToken);

          try {
            // Save token to Supabase client_profiles
            // We update both common token columns (fcm_token and expo_push_token) to avoid database schema strictness issues
            const { error: dbError } = await supabase
              .from('client_profiles')
              .update({
                fcm_token: deviceToken,
                expo_push_token: deviceToken,
              } as any)
              .eq('id', userId);

            if (dbError) {
              console.warn("Could not save token in client_profiles table (table may not have columns fcm_token or expo_push_token yet):", dbError);
              
              // Try profiles table fallback as well if applicable
              await supabase
                .from('profiles' as any)
                .update({
                  fcm_token: deviceToken,
                  expo_push_token: deviceToken,
                } as any)
                .eq('id', userId);
            }
          } catch (e) {
            console.warn("Database storage of token skipped or failed:", e);
          }

          resolve({ token: deviceToken, error: null });
        });

        // Handle error
        PushNotifications.addListener('registrationError', (error: any) => {
          console.error('Push registration error: ', error);
          resolve({ token: null, error: error.error || "Erreur d'enregistrement FCM" });
        });
      });
    } catch (err: any) {
      console.error("Erreur d'initialisation des notifications push :", err);
      return { token: null, error: err.message || "Notifications push non disponibles sur cette plateforme" };
    }
  };

  return {
    takeOrSelectPhoto,
    registerPushNotifications,
    isNative,
    pushToken,
  };
}
