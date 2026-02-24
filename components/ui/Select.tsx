import React from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export function Select({ label, error, options, className = '', ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-mono tracking-widest text-[#8a8a94] uppercase">
          {label}
        </label>
      )}
      <select
        className={`bg-[#111118] border ${
          error ? 'border-red-500' : 'border-[#1e1e2a]'
        } text-[#e8e6e3] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#fbbf24] transition-colors ${className}`}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
