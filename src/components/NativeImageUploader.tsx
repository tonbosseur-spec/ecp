import React, { useState } from 'react';
import { Camera as CameraIcon, Image as ImageIcon, Upload, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useNativeFeatures } from '../hooks/useNativeFeatures';
import { supabase } from '../lib/supabaseClient';

interface NativeImageUploaderProps {
  onUploadSuccess: (url: string) => void;
  label?: string;
  previewUrl?: string;
  bucketName?: string;
}

export function NativeImageUploader({
  onUploadSuccess,
  label = "Sélectionner une photo",
  previewUrl = "",
  bucketName = "course-images",
}: NativeImageUploaderProps) {
  const { takeOrSelectPhoto, isNative } = useNativeFeatures();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentPreview, setCurrentPreview] = useState(previewUrl);

  // Compress helper for Web fallback
  const compressImageWeb = (file: File, maxBytes: number = 200 * 1024): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

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
            reject(new Error("Impossible d'obtenir le contexte Canvas"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.85;
          const attemptWebCompression = () => {
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
                  attemptWebCompression();
                }
              },
              'image/jpeg',
              quality
            );
          };

          attemptWebCompression();
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // 1. Handle Native Upload
  const handleNativeUpload = async (source: 'CAMERA' | 'PHOTOS' | 'PROMPT') => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { url, error: nativeError } = await takeOrSelectPhoto({
        source,
        maxKB: 200,
      });

      if (nativeError) {
        throw new Error(nativeError);
      }

      if (url) {
        setCurrentPreview(url);
        onUploadSuccess(url);
        setSuccess(true);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Impossible de charger l'image");
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Web Upload (Fallback)
  const handleWebFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Compress first
      const compressedBlob = await compressImageWeb(file, 200 * 1024);

      const fileExt = 'jpg';
      const fileName = `web_uploads/${Date.now()}_${Math.floor(Math.random() * 100000)}.${fileExt}`;

      const { data, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, compressedBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      setCurrentPreview(publicUrl);
      onUploadSuccess(publicUrl);
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erreur de chargement de l'image");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-col items-center gap-4 p-6 bg-gray-50 border border-dashed border-gray-200 rounded-3xl relative overflow-hidden transition-all hover:bg-gray-100/50">
        
        {/* Preview image */}
        {currentPreview ? (
          <div className="relative w-36 h-36 rounded-2xl overflow-hidden shadow-md group border border-gray-100">
            <img 
              src={currentPreview} 
              alt="Aperçu" 
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
            />
            {loading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
          </div>
        ) : (
          <div className="w-24 h-24 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-400">
            {loading ? (
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            ) : (
              <ImageIcon className="w-10 h-10 stroke-[1.5]" />
            )}
          </div>
        )}

        <div className="text-center space-y-1">
          <p className="text-sm font-bold text-gray-800">{label}</p>
          <p className="text-xs text-gray-400 font-medium">JPEG compressé, max 200 Ko</p>
        </div>

        {/* Action Buttons depending on platform */}
        {isNative ? (
          <div className="flex gap-2 w-full max-w-xs mt-2">
            <button
              type="button"
              onClick={() => handleNativeUpload('CAMERA')}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold shadow-sm hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50"
            >
              <CameraIcon className="w-4 h-4 text-emerald-600" />
              Appareil
            </button>
            <button
              type="button"
              onClick={() => handleNativeUpload('PHOTOS')}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold shadow-sm hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50"
            >
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              Galerie
            </button>
          </div>
        ) : (
          <label className="relative flex items-center justify-center gap-2 w-full max-w-xs px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-2xl text-sm font-bold shadow-sm cursor-pointer hover:bg-gray-50 transition-all active:scale-98">
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Parcourir les fichiers</span>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleWebFileChange} 
              disabled={loading} 
              className="hidden" 
            />
          </label>
        )}

        {/* Feedback messages */}
        {error && (
          <div className="mt-2 text-xs text-red-600 flex items-center gap-1.5 bg-red-50 border border-red-100 p-2.5 rounded-xl w-full">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="mt-2 text-xs text-emerald-600 flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl w-full">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Image enregistrée et compressée avec succès !</span>
          </div>
        )}
      </div>
    </div>
  );
}
