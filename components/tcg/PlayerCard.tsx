"use client";

import React, { useState } from "react";
import type { CardRarity } from "@/lib/firestore";
import { getRarityMeta } from "@/lib/tcg";

const NBA_HEADSHOT_URL = (nbaId: number) =>
  `https://cdn.nba.com/headshots/nba/latest/260x190/${nbaId}.png`;

interface PlayerCardProps {
  playerName: string;
  teamAbbreviation: string;
  position: string;
  rarity: CardRarity;
  nbaId?: number;
  season?: number;
  stats: {
    pts: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    pra: number;
    stocks: number;
  };
  faceDown?: boolean;
  onFlip?: () => void;
  compact?: boolean;
}

export function PlayerCard({
  playerName,
  teamAbbreviation,
  position,
  rarity,
  nbaId,
  season,
  stats,
  faceDown = false,
  onFlip,
  compact = false,
}: PlayerCardProps) {
  const [revealed, setRevealed] = useState(!faceDown);
  const [showBack, setShowBack] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const meta = getRarityMeta(rarity);
  const power = Math.round(stats.pra + stats.stocks * 2);

  // ── Pack reveal state ──────────────────────────────────────────────
  if (!revealed) {
    return (
      <button
        onClick={() => { setRevealed(true); onFlip?.(); }}
        className="w-full aspect-2.5/4 rounded-xl border-2 border-[#fbbf24]/30 bg-[#111118] flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#fbbf24]/60 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
      >
        <div className="w-12 h-12 rounded-full bg-[#fbbf24]/10 flex items-center justify-center">
          <span className="text-[#fbbf24] text-2xl">?</span>
        </div>
        <span className="font-mono text-xs text-[#5a5a64] uppercase tracking-widest">
          Tap to reveal
        </span>
      </button>
    );
  }

  // ── Compact view (no flip) ─────────────────────────────────────────
  if (compact) {
    return (
      <div
        className="relative rounded-lg border-2 bg-[#111118] p-2.5 flex items-center gap-2"
        style={{ borderColor: meta.color, boxShadow: `0 0 8px ${meta.glowColor}` }}
      >
        <div className="w-9 h-9 rounded-full overflow-hidden bg-[#0a0a0f] flex-shrink-0 flex items-center justify-center">
          {nbaId && !imgError ? (
            <img
              src={NBA_HEADSHOT_URL(nbaId)}
              alt={`${playerName} headshot`}
              onError={() => setImgError(true)}
              className="w-full h-full object-contain"
            />
          ) : (
            <PlayerSilhouette small />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-mono font-bold text-[11px] text-[#e8e6e3] truncate leading-tight">
            {playerName}
          </div>
          <div className="font-mono text-[9px] text-[#5a5a64]">
            {teamAbbreviation} · {position || "—"}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="font-mono text-[8px] text-[#5a5a64] uppercase">PWR</div>
          <div className="font-mono font-bold text-xs" style={{ color: meta.color }}>
            {power}
          </div>
        </div>
      </div>
    );
  }

  // ── Full card with flip ────────────────────────────────────────────
  return (
    <div
      className="relative w-full aspect-2.5/4 cursor-pointer select-none"
      style={{ perspective: "1000px" }}
      onMouseEnter={() => setShowBack(true)}
      onMouseLeave={() => setShowBack(false)}
      onClick={() => setShowBack((s) => !s)}
    >
      <div
        className="relative w-full h-full transition-transform duration-700"
        style={{
          transformStyle: "preserve-3d",
          transform: showBack ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* ── FRONT ── */}
        <div
          className="absolute inset-0 rounded-xl overflow-hidden border-2 flex flex-col"
          style={{
            backfaceVisibility: "hidden",
            borderColor: meta.color,
            boxShadow: `0 0 28px ${meta.glowColor}, inset 0 0 20px ${meta.glowColor}`,
            background: `linear-gradient(155deg, ${meta.color}28 0%, #0e0e16 45%, #111118 100%)`,
          }}
        >
          {/* Top accent bar */}
          <div className="h-1 w-full flex-shrink-0" style={{ backgroundColor: meta.color }} />

          <div className="flex flex-col flex-1 p-3 gap-2">
            {/* Name row */}
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0 flex-1">
                <h3 className="font-mono font-bold text-[#e8e6e3] text-[11px] leading-tight truncate">
                  {playerName}
                </h3>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="font-mono text-[9px] text-[#8a8a94] uppercase">{teamAbbreviation}</span>
                  <span className="text-[#3a3a44] text-[9px]">·</span>
                  <span className="font-mono text-[9px] text-[#5a5a64] uppercase">{position || "—"}</span>
                </div>
              </div>
              {/* PWR badge */}
              <div
                className="flex-shrink-0 flex flex-col items-center px-2 py-1 rounded-lg"
                style={{ backgroundColor: `${meta.color}22`, border: `1px solid ${meta.color}44` }}
              >
                <span className="font-mono text-[7px] text-[#5a5a64] uppercase tracking-wider leading-none">PWR</span>
                <span className="font-mono font-bold text-sm leading-tight" style={{ color: meta.color }}>
                  {power}
                </span>
              </div>
            </div>

            {/* Headshot */}
            <div
              className="relative flex-1 rounded-lg overflow-hidden flex items-center justify-center"
              style={{
                background: `radial-gradient(ellipse at center, ${meta.color}18 0%, #0a0a0f 70%)`,
                border: `1px solid ${meta.color}33`,
              }}
            >
              {nbaId && !imgError ? (
                <>
                  {imgLoading && (
                    <div className="absolute inset-0 bg-[#1a1a24] animate-pulse" />
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
              {/* Corner gem */}
              <div
                className="absolute top-2 right-2 w-2 h-2 rounded-full"
                style={{ backgroundColor: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
              />
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between pt-2 flex-shrink-0"
              style={{ borderTop: `1px solid ${meta.color}22` }}
            >
              <span className="font-mono text-[8px] text-[#3a3a44] uppercase tracking-widest">
                The UnOfficial TCG
              </span>
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${meta.color}22` }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                <span
                  className="font-mono text-[8px] uppercase tracking-widest"
                  style={{ color: meta.color }}
                >
                  {meta.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── BACK (stats) ── */}
        <div
          className="absolute inset-0 rounded-xl overflow-hidden border-2 flex flex-col"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderColor: meta.color,
            boxShadow: `0 0 28px ${meta.glowColor}, inset 0 0 20px ${meta.glowColor}`,
            background: `linear-gradient(200deg, #111118 55%, ${meta.color}18 100%)`,
          }}
        >
          <div className="h-1 w-full flex-shrink-0" style={{ backgroundColor: meta.color }} />

          <div className="flex flex-col flex-1 p-3 gap-2">
            {/* Back header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono font-bold text-[11px] text-[#e8e6e3] leading-tight truncate">
                  {playerName}
                </p>
                <p className="font-mono text-[9px] text-[#5a5a64]">
                  {teamAbbreviation} · {position || "—"}
                </p>
              </div>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${meta.color}22`, border: `1px solid ${meta.color}44` }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
              </div>
            </div>

            {/* Primary stats */}
            <div className="grid grid-cols-3 gap-1.5 flex-1">
              <StatCell label="PPG" value={stats.pts} color={meta.color} primary />
              <StatCell label="REB" value={stats.reb} color={meta.color} primary />
              <StatCell label="AST" value={stats.ast} color={meta.color} primary />
              <StatCell label="STL" value={stats.stl} color={meta.color} />
              <StatCell label="BLK" value={stats.blk} color={meta.color} />
              <StatCell label="PRA" value={stats.pra} color={meta.color} />
            </div>

            {/* Bottom strip */}
            <div
              className="grid grid-cols-3 pt-2 flex-shrink-0"
              style={{ borderTop: `1px solid ${meta.color}22` }}
            >
              <div className="text-center">
                <div className="font-mono text-[7px] text-[#5a5a64] uppercase tracking-wider">Stocks</div>
                <div className="font-mono font-bold text-[11px]" style={{ color: meta.color }}>
                  {stats.stocks}
                </div>
              </div>
              <div className="text-center">
                <div className="font-mono text-[7px] text-[#5a5a64] uppercase tracking-wider">Power</div>
                <div className="font-mono font-bold text-[11px]" style={{ color: meta.color }}>
                  {power}
                </div>
              </div>
              <div className="text-center">
                <div className="font-mono text-[7px] text-[#5a5a64] uppercase tracking-wider">Season</div>
                <div className="font-mono font-bold text-[11px] text-[#8a8a94]">
                  {season ?? "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  color,
  primary,
}: {
  label: string;
  value: number;
  color: string;
  primary?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg py-1.5"
      style={{ backgroundColor: "rgba(10,10,15,0.7)", border: "1px solid rgba(255,255,255,0.04)" }}
    >
      <span className="font-mono text-[7px] text-[#5a5a64] uppercase tracking-wider leading-none mb-0.5">
        {label}
      </span>
      <span
        className={`font-mono font-bold leading-none ${primary ? "text-base" : "text-sm"}`}
        style={{ color: primary ? color : "#e8e6e3" }}
      >
        {value}
      </span>
    </div>
  );
}

function PlayerSilhouette({ small }: { small?: boolean }) {
  return (
    <svg
      viewBox="0 0 80 80"
      className={`${small ? "w-5 h-5" : "w-14 h-14"} opacity-20`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="40" cy="28" r="16" fill="#8a8a94" />
      <path d="M12 80 C12 54 24 46 40 46 C56 46 68 54 68 80" fill="#8a8a94" />
    </svg>
  );
}
