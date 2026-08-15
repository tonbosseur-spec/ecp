import React, { useState, useEffect } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  skeletonClassName?: string;
  containerClassName?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

export function LazyImage({
  src,
  alt,
  className = '',
  skeletonClassName = '',
  containerClassName = '',
  onError,
  onLoad,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    if (onLoad) onLoad(e);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    setIsLoaded(true); // Stop skeleton on error
    if (onError) onError(e);
  };

  return (
    <div className={`relative overflow-hidden inline-block ${containerClassName}`}>
      {/* Skeleton loading animation */}
      {!isLoaded && !hasError && (
        <div
          className={`absolute inset-0 bg-slate-200/80 dark:bg-slate-700/80 animate-pulse rounded-inherit z-10 ${skeletonClassName}`}
          aria-hidden="true"
        />
      )}

      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
        className={`transition-opacity duration-300 ${
          isLoaded && !hasError ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        {...props}
      />
    </div>
  );
}
