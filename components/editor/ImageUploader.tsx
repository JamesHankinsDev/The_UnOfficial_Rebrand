'use client'

import React, { useRef, useState } from 'react'
import Image from 'next/image'
import { uploadCoverImage } from '@/lib/storage'
import toast from 'react-hot-toast'

interface ImageUploaderProps {
  articleId: string
  currentUrl?: string | null
  onUpload: (url: string) => void
  label?: string
}

export function ImageUploader({
  articleId,
  currentUrl,
  onUpload,
  label = 'Cover Image',
}: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl || null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed.')
      return
    }
    setPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const url = await uploadCoverImage(articleId, file)
      onUpload(url)
      toast.success('Image uploaded.')
    } catch {
      setPreview(currentUrl || null)
      toast.error('Image upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      <div className="font-mono text-xs text-[#5a5a64] uppercase tracking-widest mb-2">
        {label}
      </div>
      <div
        className="relative border-2 border-dashed border-[#1e1e2a] rounded-lg overflow-hidden cursor-pointer hover:border-[#fbbf24]/50 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        style={{ minHeight: '120px' }}
      >
        {preview ? (
          <div className="relative aspect-video w-full">
            <Image src={preview} alt="Cover preview" fill className="object-cover" />
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="font-mono text-xs text-[#fbbf24]">Uploading…</span>
              </div>
            )}
            <div className="absolute bottom-2 right-2">
              <span className="text-xs font-mono bg-[#0a0a0f]/80 text-[#8a8a94] px-2 py-1 rounded">
                Click to change
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center gap-2">
            <div className="text-2xl">🖼️</div>
            <span className="text-xs font-mono text-[#5a5a64]">
              {uploading ? 'Uploading…' : 'Drop or click to upload'}
            </span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        className="hidden"
      />
    </div>
  )
}
