import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      className = '',
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses = {
      primary: 'bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-900 border border-transparent shadow-sm',
      secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 focus:ring-gray-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 border border-transparent shadow-sm',
      ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 border border-transparent focus:ring-gray-400',
    };

    const sizeClasses = {
      sm: 'py-2 px-3 text-xs',
      md: 'py-3 px-4 text-sm',
      lg: 'py-3.5 px-6 text-base',
    };

    const spinnerSizes = {
      sm: 'h-4 w-4 -ml-0.5 mr-1.5',
      md: 'h-5 w-5 -ml-1 mr-2',
      lg: 'h-5 w-5 -ml-1 mr-2.5',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className={`animate-spin shrink-0 ${spinnerSizes[size]}`} />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
