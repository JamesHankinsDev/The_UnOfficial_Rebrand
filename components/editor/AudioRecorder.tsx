'use client'

import React, { useState, useRef } from 'react'
import { uploadAudio, uploadAudioFile } from '@/lib/storage'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'

type RecordStatus = 'idle' | 'recording' | 'uploading' | 'saved'

interface AudioRecorderProps {
  articleId: string
  currentUrl?: string | null
  onUpload: (url: string) => void
}

export function AudioRecorder({ articleId, currentUrl, onUpload }: AudioRecorderProps) {
  const [status, setStatus] = useState<RecordStatus>(currentUrl ? 'saved' : 'idle')
  const [duration, setDuration] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(currentUrl || null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setStatus('uploading')
        try {
          const url = await uploadAudio(articleId, blob)
          setAudioUrl(url)
          onUpload(url)
          setStatus('saved')
          toast.success('Audio uploaded.')
        } catch {
          setStatus('idle')
          toast.error('Upload failed.')
        }
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setStatus('recording')
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch {
      toast.error('Microphone access denied.')
    }
  }

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus('uploading')
    try {
      const url = await uploadAudioFile(articleId, file)
      setAudioUrl(url)
      onUpload(url)
      setStatus('saved')
      toast.success('Audio uploaded.')
    } catch {
      setStatus('idle')
      toast.error('Upload failed.')
    }
  }

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const statusLabels: Record<RecordStatus, string> = {
    idle: 'No audio',
    recording: `Recording ${formatDuration(duration)}`,
    uploading: 'Uploading…',
    saved: 'Audio saved',
  }

  return (
    <div className="bg-[#0a0a0f] border border-[#1e1e2a] rounded-lg p-4">
      <div className="font-mono text-xs text-[#5a5a64] uppercase tracking-widest mb-3">
        Audio
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-2 h-2 rounded-full ${
            status === 'recording'
              ? 'bg-red-500 animate-pulse'
              : status === 'saved'
              ? 'bg-[#10b981]'
              : 'bg-[#3a3a44]'
          }`}
        />
        <span className="text-sm font-mono text-[#8a8a94]">{statusLabels[status]}</span>
      </div>

      {audioUrl && status === 'saved' && (
        <audio controls src={audioUrl} className="w-full mb-3 h-8" />
      )}

      <div className="flex items-center gap-2">
        {status === 'idle' || status === 'saved' ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={startRecording}
              className="flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {status === 'saved' ? 'Re-record' : 'Record'}
            </Button>
            <button
              className="text-xs font-mono text-[#5a5a64] hover:text-[#e8e6e3] transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              or upload file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </>
        ) : status === 'recording' ? (
          <Button variant="danger" size="sm" onClick={stopRecording}>
            Stop Recording
          </Button>
        ) : (
          <span className="text-xs font-mono text-[#5a5a64]">Uploading…</span>
        )}
      </div>
    </div>
  )
}
