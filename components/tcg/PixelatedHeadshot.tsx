"use client";

import React, { useEffect, useState } from "react";
import { pixelateImageUrl } from "@/lib/pixelate";

interface PixelatedHeadshotProps {
  url: string;
  alt: string;
  className?: string;
  onError?: () => void;
}

export function PixelatedHeadshot({ url, alt, className, onError }: PixelatedHeadshotProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setFailed(false);
    pixelateImageUrl(url)
      .then((d) => {
        if (!cancelled) setDataUrl(d);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        onError?.();
      });
    return () => {
      cancelled = true;
    };
  }, [url, onError]);

  if (failed) return null;
  if (!dataUrl) {
    return <div className={`${className ?? ""} bg-[#1a1a24] animate-pulse`} />;
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      className={className}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
