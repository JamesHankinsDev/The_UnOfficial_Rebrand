import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-mono tracking-widest text-[#8a8a94] uppercase">
          {label}
        </label>
      )}
      <input
        className={`bg-[#111118] border ${
          error ? 'border-red-500' : 'border-[#1e1e2a]'
        } text-[#e8e6e3] rounded-md px-3 py-2 text-sm placeholder:text-[#5a5a64] focus:outline-none focus:border-[#fbbf24] transition-colors ${className}`}
        {...props}
      />
      {hint && !error && <p className="text-xs text-[#5a5a64]">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export function Textarea({ label, error, hint, className = '', ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-mono tracking-widest text-[#8a8a94] uppercase">
          {label}
        </label>
      )}
      <textarea
        className={`bg-[#111118] border ${
          error ? 'border-red-500' : 'border-[#1e1e2a]'
        } text-[#e8e6e3] rounded-md px-3 py-2 text-sm placeholder:text-[#5a5a64] focus:outline-none focus:border-[#fbbf24] transition-colors resize-y ${className}`}
        {...props}
      />
      {hint && !error && <p className="text-xs text-[#5a5a64]">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
