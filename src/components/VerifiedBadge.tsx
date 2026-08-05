import React from 'react';

interface VerifiedBadgeProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export default function VerifiedBadge({ className = '', size = 'sm', showTooltip = true }: VerifiedBadgeProps) {
  const sizeMap = {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <span 
      className={`inline-flex items-center align-middle shrink-0 ${className}`}
      title={showTooltip ? "Membre Vérifié & Client Premium" : undefined}
    >
      <svg 
        className={`${sizeMap[size]} shrink-0 drop-shadow-xs hover:scale-110 transition-transform cursor-pointer`} 
        viewBox="0 0 24 24" 
        fill="none"
      >
        <path 
          d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.38-1.93-4.31-4.31-4.31-.495 0-.965.084-1.4.238C13.62 2.15 12.25 1.275 10.67 1.275c-1.58 0-2.95.875-3.6 2.148-.435-.154-.905-.238-1.4-.238-2.38 0-4.31 1.93-4.31 4.31 0 .495.084.965.238 1.4C.325 9.55-.55 10.92-.55 12.5c0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.38 1.93 4.31 4.31 4.31.495 0 .965-.084 1.4-.238 1.28 1.273 2.65 2.148 4.23 2.148 1.58 0 2.95-.875 3.6-2.148.435.154.905.238 1.4.238 2.38 0 4.31-1.93 4.31-4.31 0-.495-.084-.965-.238-1.4 1.273-1.28 2.148-2.65 2.148-4.23z" 
          fill="url(#verified-grad-seal)" 
        />
        <path 
          d="M10.09 15.59L6.5 12l1.41-1.41 2.18 2.18 5.88-5.88L17.38 8.3l-7.29 7.29z" 
          fill="#FFFFFF" 
        />
        <defs>
          <linearGradient id="verified-grad-seal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="50%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}
