import React from 'react';

interface PageTransitionProps {
  children: React.ReactNode;
  key?: string | number;
}

export default function PageTransition({ children }: PageTransitionProps) {
  return (
    <div className="w-full min-h-screen transition-opacity duration-200">
      {children}
    </div>
  );
}

