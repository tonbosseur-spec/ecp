import React from 'react';
import { Loader2 } from 'lucide-react';

interface SplashScreenProps {
  message?: string;
}

export default function SplashScreen({ message = 'Chargement en cours...' }: SplashScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 select-none overflow-hidden">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
        <p className="text-gray-600 dark:text-gray-300 text-sm font-semibold tracking-wide">
          {message}
        </p>
      </div>
    </div>
  );
}
