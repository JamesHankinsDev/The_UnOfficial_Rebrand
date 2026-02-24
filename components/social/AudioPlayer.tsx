'use client'

import React, { useRef, useState, useEffect } from 'react'

interface AudioPlayerProps {
  url: string
  title?: string
}

export function AudioPlayer({ url, title }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoaded = () => setDuration(audio.duration)
    const onEnded = () => setPlaying(false)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      audio.play()
    }
    setPlaying(!playing)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const t = Number(e.target.value)
    audio.currentTime = t
    setCurrentTime(t)
  }

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="bg-[#111118] border border-[#1e1e2a] rounded-lg p-4 flex items-center gap-4">
      <audio ref={audioRef} src={url} preload="metadata" />

      <button
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-[#fbbf24] text-[#0a0a0f] flex items-center justify-center hover:bg-[#f59e0b] transition-colors flex-shrink-0"
      >
        {playing ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6zm8-14v14h4V5z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        {title && (
          <div className="text-xs font-mono text-[#8a8a94] mb-1.5 truncate">{title}</div>
        )}
        <div className="relative h-5 flex items-center">
          <div className="h-1 bg-[#1e1e2a] rounded-full overflow-hidden w-full">
            <div
              className="h-full bg-[#fbbf24] transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 opacity-0 w-full cursor-pointer"
          />
        </div>
      </div>

      <div className="font-mono text-xs text-[#5a5a64] flex-shrink-0 tabular-nums">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>
  )
}
