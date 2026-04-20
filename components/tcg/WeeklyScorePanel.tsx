"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  currentWeekWindow,
  formatWeekLabel,
} from "@/lib/tcg-week";
import type { LineupScoreDoc, PerPlayerScore } from "@/lib/firestore";
import { getLineupScore } from "@/lib/firestore";
import { LINEUP_SLOT_POSITIONS, SLOT_POSITION_LABELS } from "@/lib/tcg-positions";

interface WeeklyScorePanelProps {
  /** Bumped by parent to force a fresh recompute. */
  refreshKey?: number;
}

export function WeeklyScorePanel({ refreshKey }: WeeklyScorePanelProps) {
  const { user } = useAuth();
  const [week] = useState(() => currentWeekWindow());
  const [score, setScore] = useState<LineupScoreDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setScore(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Read the frozen snapshot first so we can show the lineup
        // immediately; then kick off a live recompute.
        const frozen = await getLineupScore(week.weekId, user.uid);
        if (cancelled) return;
        setScore(frozen);
        setLoading(false);

        if (!frozen) return;

        // Live recompute via API (authed).
        setRecomputing(true);
        const token = await user.getIdToken();
        const res = await fetch(
          `/api/tcg/lineup-score?weekId=${week.weekId}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) {
          if (res.status !== 404) {
            throw new Error(`Score API returned ${res.status}`);
          }
          return;
        }
        const updated = (await res.json()) as LineupScoreDoc;
        if (!cancelled) setScore(updated);
      } catch (err) {
        console.error("Failed to load weekly score:", err);
        if (!cancelled) setError("Couldn't compute this week's score.");
      } finally {
        if (!cancelled) setRecomputing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, week.weekId, refreshKey]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="mb-6 p-5 bg-[#0e0e16] border border-[#1e1e2a] rounded-xl animate-pulse h-24" />
    );
  }

  if (!score) {
    return (
      <div className="mb-6 p-5 bg-[#0e0e16] border border-[#1e1e2a] rounded-xl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#5a5a64]">
              {formatWeekLabel(week.weekId)}
            </p>
            <h3 className="font-mono font-bold text-[#e8e6e3] text-base mt-1">
              No locked lineup this week
            </h3>
            <p className="font-mono text-xs text-[#8a8a94] mt-1 max-w-lg">
              Fill all five slots with a valid G-G-F-F-C roster — your lineup
              auto-locks when the next week starts Monday and the leaderboard
              opens up.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 bg-[#0e0e16] border border-[#fbbf24]/30 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 flex-wrap p-5 border-b border-[#1e1e2a]"
        style={{
          background:
            "linear-gradient(135deg, rgba(251,191,36,0.08), transparent 60%)",
        }}
      >
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#fbbf24]/80">
            {formatWeekLabel(score.weekId)} · Locked
          </p>
          <h3 className="font-mono font-bold text-[#e8e6e3] text-lg mt-1">
            This Week&rsquo;s Score
          </h3>
          <p className="font-mono text-[11px] text-[#5a5a64] mt-1">
            {score.final ? "Final" : recomputing ? "Refreshing…" : "Live"}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#fbbf24]/80">
            Total
          </span>
          <span className="font-mono font-bold text-4xl text-[#fbbf24] leading-none mt-1">
            {score.total.toFixed(1)}
          </span>
        </div>
      </div>

      {error && (
        <p className="px-5 py-2 font-mono text-xs text-red-400 border-b border-[#1e1e2a]">
          {error}
        </p>
      )}

      {/* Per-player breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-4">
        {score.playerIds.map((pid, i) => {
          const slot = LINEUP_SLOT_POSITIONS[i];
          const entry = pid != null
            ? score.perPlayer.find((p) => p.playerId === pid)
            : undefined;
          return (
            <PlayerRow
              key={i}
              slotIndex={i}
              slotLabel={SLOT_POSITION_LABELS[slot]}
              entry={entry}
              empty={pid == null}
            />
          );
        })}
      </div>
    </div>
  );
}

function PlayerRow({
  slotIndex,
  slotLabel,
  entry,
  empty,
}: {
  slotIndex: number;
  slotLabel: string;
  entry: PerPlayerScore | undefined;
  empty: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg bg-[#111118] border border-[#1e1e2a]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#5a5a64]">
          {slotIndex + 1} · {slotLabel}
        </span>
        {entry && (
          <span className="font-mono text-[9px] text-[#8a8a94]">
            {entry.gamesPlayed} {entry.gamesPlayed === 1 ? "GP" : "GP"}
          </span>
        )}
      </div>
      {empty || !entry ? (
        <p className="font-mono text-xs text-[#5a5a64]">—</p>
      ) : (
        <>
          <p className="font-mono font-bold text-[#e8e6e3] text-sm truncate">
            {entry.playerName}
          </p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#5a5a64]">
              Avg
            </span>
            <span className="font-mono font-bold text-[#fbbf24] text-base">
              {entry.perGameAvg.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center justify-between font-mono text-[10px] text-[#8a8a94]">
            <span>PRA {entry.totalPra.toFixed(0)}</span>
            <span>STK {entry.totalStocks.toFixed(0)}</span>
          </div>
        </>
      )}
    </div>
  );
}
