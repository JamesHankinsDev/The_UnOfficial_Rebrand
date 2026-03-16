"use client";

import React, { useState } from "react";
import type { CardRarity } from "@/lib/firestore";
import { getRarityMeta } from "@/lib/tcg";
import { RarityBadge } from "./RarityBadge";

const NBA_HEADSHOT_URL = (nbaId: number) =>
  `https://cdn.nba.com/headshots/nba/latest/260x190/${nbaId}.png`;

interface PlayerCardProps {
  playerName: string;
  teamAbbreviation: string;
  position: string;
  rarity: CardRarity;
  nbaId?: number;
  stats: {
    pts: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    pra: number;
    stocks: number;
  };
  /** If true, card starts face-down for reveal animation */
  faceDown?: boolean;
  /** Callback when card is flipped */
  onFlip?: () => void;
  compact?: boolean;
}

export function PlayerCard({
  playerName,
  teamAbbreviation,
  position,
  rarity,
  nbaId,
  stats,
  faceDown = false,
  onFlip,
  compact = false,
}: PlayerCardProps) {
  const [flipped, setFlipped] = useState(!faceDown);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const meta = getRarityMeta(rarity);

  const handleFlip = () => {
    if (!flipped) {
      setFlipped(true);
      onFlip?.();
    }
  };

  if (!flipped) {
    return (
      <button
        onClick={handleFlip}
        className="w-full aspect-[2.5/3.5] rounded-xl border-2 border-[#fbbf24]/30 bg-[#111118] flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#fbbf24]/60 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
      >
        <div className="w-10 h-10 rounded-full bg-[#fbbf24]/10 flex items-center justify-center">
          <span className="text-[#fbbf24] text-lg">?</span>
        </div>
        <span className="font-mono text-xs text-[#5a5a64] uppercase tracking-widest">
          Tap to reveal
        </span>
      </button>
    );
  }

  return (
    <div
      className={`relative rounded-xl border-2 bg-[#111118] overflow-hidden transition-all duration-500 ${
        compact ? "" : "aspect-2.5/4"
      }`}
      style={{
        borderColor: meta.color,
        boxShadow: `0 0 20px ${meta.glowColor}, inset 0 0 20px ${meta.glowColor}`,
      }}
    >
      {/* Rarity accent bar */}
      <div className="h-1 w-full" style={{ backgroundColor: meta.color }} />

      <div className={`flex flex-col ${compact ? "p-3" : "p-4"} h-full`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <h3
              className={`font-mono font-bold text-[#e8e6e3] leading-tight truncate ${
                compact ? "text-xs" : "text-sm"
              }`}
            >
              {playerName}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-[10px] text-[#8a8a94]">
                {teamAbbreviation}
              </span>
              <span className="font-mono text-[10px] text-[#5a5a64]">
                {position || "—"}
              </span>
            </div>
          </div>
          <RarityBadge rarity={rarity} />
        </div>

        {/* Headshot */}
        {!compact && (
          <div className="relative w-full h-24 rounded-lg overflow-hidden bg-[#0d0d14] mb-2 flex items-center justify-center">
            {nbaId && !imgError ? (
              <>
                {imgLoading && (
                  <div className="absolute inset-0 bg-brand-border animate-pulse rounded-lg" />
                )}
                <img
                  src={NBA_HEADSHOT_URL(nbaId)}
                  alt={`${playerName} headshot`}
                  onLoad={() => setImgLoading(false)}
                  onError={() => { setImgLoading(false); setImgError(true); }}
                  className={`w-full h-full object-contain transition-opacity duration-300 ${
                    imgLoading ? "opacity-0" : "opacity-100"
                  }`}
                />
              </>
            ) : (
              <PlayerSilhouette />
            )}
          </div>
        )}

        {/* Stats grid */}
        <div className={`grid grid-cols-3 gap-2 ${compact ? "mt-1" : "mt-auto"}`}>
          <MiniStat label="PTS" value={stats.pts} highlight />
          <MiniStat label="REB" value={stats.reb} />
          <MiniStat label="AST" value={stats.ast} />
          <MiniStat label="STL" value={stats.stl} />
          <MiniStat label="BLK" value={stats.blk} />
          <MiniStat label="PRA" value={stats.pra} highlight />
        </div>

        {/* Footer */}
        {!compact && (
          <div className="mt-auto pt-2 flex items-center justify-between border-t border-[#1e1e2a]">
            <span className="font-mono text-[9px] text-[#3a3a44] uppercase tracking-widest">
              The UnOfficial TCG
            </span>
            <span
              className="font-mono text-[9px] uppercase tracking-widest"
              style={{ color: meta.color }}
            >
              {meta.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerSilhouette() {
  return (
    <svg viewBox="0 0 80 80" className="w-12 h-12 opacity-20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="28" r="16" fill="#8a8a94" />
      <path d="M12 80 C12 54 24 46 40 46 C56 46 68 54 68 80" fill="#8a8a94" />
    </svg>
  );
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="font-mono text-[8px] text-[#5a5a64] uppercase tracking-wider">
        {label}
      </div>
      <div
        className={`font-mono text-sm font-bold ${
          highlight ? "text-[#fbbf24]" : "text-[#e8e6e3]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
