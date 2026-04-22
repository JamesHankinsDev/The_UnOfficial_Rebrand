'use client'

import React, { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  size?: 'md' | 'lg' | 'xl'
  children: React.ReactNode
}

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ open, onClose, title, size = 'md', children }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative bg-[#111118] border border-[#1e1e2a] rounded-xl p-6 w-full shadow-2xl max-h-[90vh] overflow-y-auto ${SIZE_CLASS[size]}`}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono font-bold text-[#e8e6e3] tracking-wide">{title}</h3>
            <button
              onClick={onClose}
              className="text-[#5a5a64] hover:text-[#e8e6e3] transition-colors text-xl leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
