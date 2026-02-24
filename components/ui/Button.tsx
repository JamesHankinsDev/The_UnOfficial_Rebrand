import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-mono font-bold tracking-wide transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

  const variants = {
    primary: 'bg-[#fbbf24] text-[#0a0a0f] hover:bg-[#f59e0b] active:scale-95',
    secondary:
      'bg-[#1e1e2a] text-[#e8e6e3] border border-[#1e1e2a] hover:border-[#fbbf24] hover:text-[#fbbf24] active:scale-95',
    ghost: 'text-[#8a8a94] hover:text-[#e8e6e3] hover:bg-[#1e1e2a] active:scale-95',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:scale-95',
  }

  const sizes = {
    sm: 'text-xs px-3 py-1.5 rounded',
    md: 'text-sm px-4 py-2 rounded-md',
    lg: 'text-base px-6 py-3 rounded-lg',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  )
}
