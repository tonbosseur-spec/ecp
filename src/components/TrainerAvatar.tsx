import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';

interface TrainerAvatarProps {
  photoUrl?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
  iconClassName?: string;
  alt?: string;
  skeletonClassName?: string;
}

export function TrainerAvatar({
  photoUrl,
  name,
  className = "w-14 h-14 rounded-2xl object-cover shrink-0",
  fallbackClassName = "w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-600 font-bold text-sm",
  iconClassName = "w-6 h-6",
  skeletonClassName = "bg-slate-200 animate-pulse",
  alt,
}: TrainerAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset loading and error states if photoUrl changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [photoUrl]);

  const displayName = name?.trim() || 'Formateur';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  if (photoUrl && !imageError) {
    return (
      <div className="relative inline-block shrink-0 overflow-hidden">
        {/* Skeleton Shimmer overlay while image is loading */}
        {!imageLoaded && (
          <div 
            className={`absolute inset-0 z-10 rounded-inherit ${className} ${skeletonClassName}`}
            aria-hidden="true"
          />
        )}
        <img
          src={photoUrl}
          alt={alt || `Photo de ${displayName}`}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          className={`transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        />
      </div>
    );
  }

  return (
    <div className={fallbackClassName} title={displayName}>
      {initials ? (
        <span>{initials}</span>
      ) : (
        <User className={iconClassName} />
      )}
    </div>
  );
}

