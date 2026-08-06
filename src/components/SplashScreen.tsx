import React from 'react';
import { Loader2 } from 'lucide-react';

interface SplashScreenProps {
  message?: string;
}

export default function SplashScreen({ message = 'Chargement en cours...' }: SplashScreenProps) {
  const imageUrl = "https://titncxnaixghtoerkfiu.supabase.co/storage/v1/object/public/Fichiers%20de%20formation%20&%20guides/file_00000000aa4481f4a37733d7a02e28c6.png";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black select-none overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src={imageUrl} 
          alt="Chargement" 
          className="w-full h-full object-cover object-center scale-105 transition-transform duration-1000 ease-out"
        />
        {/* Dark overlay for contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/40" />
      </div>

      {/* Spacer */}
      <div className="relative z-10 pt-12" />

      {/* Bottom Loading Box */}
      <div className="relative z-10 pb-16 px-6 flex flex-col items-center justify-center text-center">
        <div className="bg-black/60 backdrop-blur-md px-7 py-5 rounded-3xl border border-white/15 flex flex-col items-center gap-3 shadow-2xl animate-fade-in">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
          <p className="text-white text-sm font-semibold tracking-wide drop-shadow-md">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
