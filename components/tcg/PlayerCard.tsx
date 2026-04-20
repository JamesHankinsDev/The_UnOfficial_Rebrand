"use client";

import React, { useState } from "react";
import type { Archetype, CardRarity } from "@/lib/firestore";
import { ARCHETYPE_LABELS, deriveArchetype, getRarityMeta } from "@/lib/tcg";
import { ArchetypeIcon } from "./ArchetypeIcon";

const NBA_HEADSHOT_URL = (nbaId: number) =>
  `https://cdn.nba.com/headshots/nba/latest/260x190/${nbaId}.png`;

const SET_MARK = "UNOFFICIAL · P.O. '25";

interface PlayerCardProps {
  playerName: string;
  teamAbbreviation: string;
  position: string;
  rarity: CardRarity;
  archetype?: Archetype;
  foil?: boolean;
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
  /** Stable numeric id used to render the card number in the footer. */
  cardNumberSeed?: number;
}

export function PlayerCard({
  playerName,
  teamAbbreviation,
  position,
  rarity,
  archetype,
  foil = false,
  nbaId,
  season,
  stats,
  faceDown = false,
  onFlip,
  compact = false,
  cardNumberSeed,
}: PlayerCardProps) {
  const [revealed, setRevealed] = useState(!faceDown);
  const [showBack, setShowBack] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const meta = getRarityMeta(rarity);
  const power = Math.round(stats.pra + stats.stocks * 2);
  // Archetype is stored on newly-issued cards; for pre-feature cards we derive
  // it from stats so the type-line renders without a migration.
  const resolvedArchetype: Archetype = archetype ?? deriveArchetype(stats);
  const archetypeLabel = ARCHETYPE_LABELS[resolvedArchetype];
  const cardNumber = formatCardNumber(cardNumberSeed ?? nbaId);

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
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${meta.color}33, ${meta.color}11)`,
            border: `1px solid ${meta.color}55`,
            color: meta.color,
          }}
          aria-label={archetypeLabel}
          title={archetypeLabel}
        >
          <ArchetypeIcon archetype={resolvedArchetype} size={16} />
        </div>
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
            boxShadow: foil
              ? `0 0 36px ${meta.glowColor}, 0 0 16px rgba(255,255,255,0.35), inset 0 0 24px ${meta.glowColor}`
              : `0 0 28px ${meta.glowColor}, inset 0 0 20px ${meta.glowColor}`,
            background: `linear-gradient(155deg, ${meta.color}28 0%, #0e0e16 45%, #111118 100%)`,
          }}
        >
          {foil && <FoilOverlay />}

          {/* Top accent bar */}
          <div
            className="h-1.5 w-full flex-shrink-0"
            style={{
              background: `linear-gradient(90deg, ${meta.color}88 0%, ${meta.color} 50%, ${meta.color}88 100%)`,
            }}
          />

          <div className="flex flex-col flex-1 p-2.5 gap-2">
            {/* Name banner */}
            <div
              className="flex items-center gap-2 rounded-lg px-2 py-1.5"
              style={{
                background: `linear-gradient(90deg, ${meta.color}1f, transparent 90%)`,
                border: `1px solid ${meta.color}33`,
              }}
            >
              <ArchetypeBadge archetype={resolvedArchetype} color={meta.color} />
              <div className="min-w-0 flex-1">
                <h3 className="font-mono font-bold text-[#e8e6e3] text-[11px] leading-tight truncate">
                  {playerName}
                </h3>
                <div className="flex items-center gap-1 leading-none mt-0.5">
                  <span className="font-mono text-[8px] text-[#8a8a94] uppercase tracking-wider">
                    {teamAbbreviation}
                  </span>
                  <span className="text-[#3a3a44] text-[8px]">·</span>
                  <span className="font-mono text-[8px] text-[#5a5a64] uppercase tracking-wider">
                    {position || "—"}
                  </span>
                </div>
              </div>
              <PowerBadge value={power} color={meta.color} />
            </div>

            {/* Art frame */}
            <div
              className="relative flex-1 rounded-lg overflow-hidden flex items-center justify-center"
              style={{
                background: `radial-gradient(ellipse at center, ${meta.color}22 0%, #0a0a0f 70%)`,
                border: `1px solid ${meta.color}33`,
              }}
            >
              {/* Watermark archetype glyph — faint, centered behind headshot */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ color: meta.color, opacity: 0.08 }}
              >
                <ArchetypeIcon archetype={resolvedArchetype} size={140} />
              </div>

              {/* Corner brackets */}
              <CornerBracket position="tl" color={meta.color} />
              <CornerBracket position="tr" color={meta.color} />
              <CornerBracket position="bl" color={meta.color} />
              <CornerBracket position="br" color={meta.color} />

              {/* Headshot */}
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
                    className={`relative w-full h-full object-contain transition-opacity duration-300 ${
                      imgLoading ? "opacity-0" : "opacity-100"
                    }`}
                  />
                </>
              ) : (
                <PlayerSilhouette />
              )}
            </div>

            {/* Type-line chip */}
            <div
              className="flex items-center justify-center gap-1.5 rounded-md py-1 px-2"
              style={{
                background: `linear-gradient(90deg, transparent, ${meta.color}26, transparent)`,
                borderTop: `1px solid ${meta.color}33`,
                borderBottom: `1px solid ${meta.color}33`,
              }}
            >
              <span style={{ color: meta.color, display: "inline-flex" }}>
                <ArchetypeIcon archetype={resolvedArchetype} size={11} />
              </span>
              <span
                className="font-mono font-bold text-[9px] uppercase tracking-[0.18em]"
                style={{ color: meta.color }}
              >
                {archetypeLabel}
              </span>
              <span className="text-[#3a3a44] text-[9px]">·</span>
              <span
                className="font-mono text-[9px] uppercase tracking-[0.18em]"
                style={{ color: `${meta.color}bb` }}
              >
                {meta.label}
              </span>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between flex-shrink-0">
              <span className="font-mono text-[7.5px] text-[#3a3a44] uppercase tracking-widest truncate">
                {SET_MARK}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {foil && (
                  <span
                    className="font-mono text-[7px] uppercase tracking-widest px-1 py-0.5 rounded"
                    style={{
                      background:
                        "linear-gradient(90deg,#f472b6,#fbbf24,#22d3ee,#a78bfa)",
                      color: "#0a0a0f",
                      fontWeight: 700,
                    }}
                  >
                    FOIL
                  </span>
                )}
                <span className="font-mono text-[7.5px] text-[#5a5a64] tracking-widest">
                  {cardNumber}
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
            boxShadow: foil
              ? `0 0 36px ${meta.glowColor}, 0 0 16px rgba(255,255,255,0.35), inset 0 0 24px ${meta.glowColor}`
              : `0 0 28px ${meta.glowColor}, inset 0 0 20px ${meta.glowColor}`,
            background: `linear-gradient(200deg, #111118 55%, ${meta.color}18 100%)`,
          }}
        >
          {foil && <FoilOverlay />}

          <div
            className="h-1.5 w-full flex-shrink-0"
            style={{
              background: `linear-gradient(90deg, ${meta.color}88 0%, ${meta.color} 50%, ${meta.color}88 100%)`,
            }}
          />

          <div className="flex flex-col flex-1 p-2.5 gap-2">
            {/* Header mirrors the front banner */}
            <div
              className="flex items-center gap-2 rounded-lg px-2 py-1.5"
              style={{
                background: `linear-gradient(90deg, ${meta.color}1f, transparent 90%)`,
                border: `1px solid ${meta.color}33`,
              }}
            >
              <ArchetypeBadge archetype={resolvedArchetype} color={meta.color} />
              <div className="min-w-0 flex-1">
                <p className="font-mono font-bold text-[11px] text-[#e8e6e3] leading-tight truncate">
                  {playerName}
                </p>
                <p className="font-mono text-[8px] text-[#5a5a64] uppercase tracking-wider">
                  {teamAbbreviation} · {archetypeLabel}
                </p>
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
              className="grid grid-cols-3 pt-1.5 flex-shrink-0"
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

            {/* Footer mirrors front */}
            <div className="flex items-center justify-between flex-shrink-0">
              <span className="font-mono text-[7.5px] text-[#3a3a44] uppercase tracking-widest truncate">
                {SET_MARK}
              </span>
              <span className="font-mono text-[7.5px] text-[#5a5a64] tracking-widest">
                {cardNumber}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function ArchetypeBadge({ archetype, color }: { archetype: Archetype; color: string }) {
  // Hexagonal mask — classic TCG energy-icon silhouette
  const hex = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";
  return (
    <div
      aria-label={ARCHETYPE_LABELS[archetype]}
      title={ARCHETYPE_LABELS[archetype]}
      className="flex-shrink-0"
      style={{
        width: 26,
        height: 30,
        clipPath: hex,
        background: `linear-gradient(135deg, ${color}, ${color}55)`,
        padding: 1.5,
        color,
      }}
    >
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ clipPath: hex, background: "#0a0a0f" }}
      >
        <ArchetypeIcon archetype={archetype} size={14} />
      </div>
    </div>
  );
}

function PowerBadge({ value, color }: { value: number; color: string }) {
  const diamond = "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)";
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: 36,
        height: 36,
        clipPath: diamond,
        background: `linear-gradient(135deg, ${color}, ${color}77)`,
        padding: 1.5,
      }}
    >
      <div
        className="w-full h-full flex flex-col items-center justify-center"
        style={{ clipPath: diamond, background: "#0a0a0f" }}
      >
        <span className="font-mono text-[6.5px] text-[#5a5a64] uppercase tracking-wider leading-none">
          PWR
        </span>
        <span
          className="font-mono font-bold text-[13px] leading-none mt-0.5"
          style={{ color }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function CornerBracket({
  position,
  color,
}: {
  position: "tl" | "tr" | "bl" | "br";
  color: string;
}) {
  const base = "absolute w-3 h-3 pointer-events-none";
  const posClass = {
    tl: "top-1 left-1 border-l border-t",
    tr: "top-1 right-1 border-r border-t",
    bl: "bottom-1 left-1 border-l border-b",
    br: "bottom-1 right-1 border-r border-b",
  }[position];
  return <div className={`${base} ${posClass}`} style={{ borderColor: color }} />;
}

function FoilOverlay() {
  // Holographic diagonal sheen that slowly sweeps across the card.
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 mix-blend-screen opacity-60 animate-[foil-sheen_4s_linear_infinite]"
      style={{
        background:
          "linear-gradient(115deg, transparent 20%, rgba(244,114,182,0.45) 38%, rgba(251,191,36,0.45) 48%, rgba(34,211,238,0.45) 58%, rgba(167,139,250,0.45) 68%, transparent 85%)",
        backgroundSize: "220% 220%",
      }}
    />
  );
}

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
      style={{
        backgroundColor: "rgba(10,10,15,0.7)",
        border: primary ? `1px solid ${color}33` : "1px solid rgba(255,255,255,0.04)",
      }}
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

function formatCardNumber(seed: number | undefined): string {
  if (!seed) return "#—";
  const n = Math.abs(seed) % 10000;
  return `#${n.toString().padStart(4, "0")}`;
}
