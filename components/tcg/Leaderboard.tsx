"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAllTimeTopScores,
  getLeagueWeeklyScores,
  getTopWeeklyScores,
  type LeagueDoc,
  type LineupScoreDoc,
  type PerPlayerScore,
} from "@/lib/firestore";
import {
  currentWeekWindow,
  formatWeekLabel,
  recentWeekIds,
} from "@/lib/tcg-week";
import {
  LINEUP_SLOT_POSITIONS,
  SLOT_POSITION_LABELS,
} from "@/lib/tcg-positions";
import { LeagueManager } from "./LeagueManager";

type Scope = "global" | "leagues";
type GlobalMode = "weekly" | "all-time";

const ROW_LIMIT = 20;
const WEEK_CHOICES = 6;

export function Leaderboard() {
  const [scope, setScope] = useState<Scope>("global");
  const [selectedLeague, setSelectedLeague] = useState<LeagueDoc | null>(null);

  return (
    <div>
      {/* Scope switcher */}
      <div className="flex items-center gap-1 mb-5 pb-4 border-b border-[#1e1e2a]">
        <ScopeTab
          active={scope === "global"}
          label="Global"
          onClick={() => setScope("global")}
        />
        <ScopeTab
          active={scope === "leagues"}
          label="My Leagues"
          onClick={() => setScope("leagues")}
        />
      </div>

      {scope === "global" ? (
        <GlobalView />
      ) : (
        <LeaguesView
          selectedLeague={selectedLeague}
          onSelectLeague={setSelectedLeague}
          onClearSelection={() => setSelectedLeague(null)}
        />
      )}
    </div>
  );
}

// ── Global scope ─────────────────────────────────────────────────────

function GlobalView() {
  const { user } = useAuth();
  const [mode, setMode] = useState<GlobalMode>("weekly");
  const [selectedWeekId, setSelectedWeekId] = useState(
    () => currentWeekWindow().weekId,
  );
  const [rows, setRows] = useState<LineupScoreDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekOptions = useMemo(() => recentWeekIds(WEEK_CHOICES), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load =
      mode === "weekly"
        ? getTopWeeklyScores(selectedWeekId, ROW_LIMIT)
        : getAllTimeTopScores(ROW_LIMIT);

    load
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        console.error("Leaderboard error:", err);
        if (!cancelled) {
          setError(
            "Couldn't load the leaderboard. Check Firestore rules + indexes.",
          );
          setRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, selectedWeekId]);

  const myIndex = useMemo(
    () => (user ? rows.findIndex((r) => r.uid === user.uid) : -1),
    [rows, user],
  );

  const title =
    mode === "weekly"
      ? `Top ${ROW_LIMIT} · ${formatWeekLabel(selectedWeekId)}`
      : "All-Time Best Weeks";

  const emptyCopy =
    mode === "weekly"
      ? "No scores recorded for this week yet."
      : "No finalized weeks on record yet. Come back after a week closes!";

  const nudge = !user
    ? null
    : mode === "weekly"
      ? "You're not in this week's top 20 — keep grinding."
      : "Your best week isn't in the all-time top 20 yet.";

  return (
    <>
      {/* Mode toggle */}
      <div className="flex items-center gap-1 mb-4">
        <ModeTab
          active={mode === "weekly"}
          label="Weekly"
          onClick={() => setMode("weekly")}
        />
        <ModeTab
          active={mode === "all-time"}
          label="All-Time"
          onClick={() => setMode("all-time")}
        />
      </div>

      {/* Week selector (only for weekly mode) */}
      {mode === "weekly" && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4">
          {weekOptions.map((weekId, i) => (
            <WeekPill
              key={weekId}
              active={selectedWeekId === weekId}
              label={
                i === 0
                  ? "This Week"
                  : formatWeekLabel(weekId).replace("Week of ", "")
              }
              onClick={() => setSelectedWeekId(weekId)}
            />
          ))}
        </div>
      )}

      <LeaderboardList
        title={title}
        rows={rows}
        loading={loading}
        error={error}
        emptyCopy={emptyCopy}
        currentUid={user?.uid}
        showWeekLabel={mode === "all-time"}
        nudge={!loading && !error && user && myIndex === -1 && rows.length > 0 ? nudge : null}
      />
    </>
  );
}

// ── Leagues scope ────────────────────────────────────────────────────

function LeaguesView({
  selectedLeague,
  onSelectLeague,
  onClearSelection,
}: {
  selectedLeague: LeagueDoc | null;
  onSelectLeague: (l: LeagueDoc) => void;
  onClearSelection: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <LeagueManager
        selectedLeagueId={selectedLeague?.id ?? null}
        onSelectLeague={onSelectLeague}
        onClearSelection={onClearSelection}
      />
      {selectedLeague && (
        <LeagueLeaderboardPane
          league={selectedLeague}
          onBack={onClearSelection}
        />
      )}
    </div>
  );
}

function LeagueLeaderboardPane({
  league,
  onBack,
}: {
  league: LeagueDoc;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const [selectedWeekId, setSelectedWeekId] = useState(
    () => currentWeekWindow().weekId,
  );
  const [rows, setRows] = useState<LineupScoreDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekOptions = useMemo(() => recentWeekIds(WEEK_CHOICES), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getLeagueWeeklyScores(selectedWeekId, league.memberUids)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        console.error("League leaderboard error:", err);
        if (!cancelled) {
          setError(
            "Couldn't load the league leaderboard. Check Firestore indexes.",
          );
          setRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedWeekId, league.memberUids]);

  return (
    <div className="rounded-xl border border-[#1e1e2a] bg-[#0a0a0f] p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#fbbf24]/80">
            League
          </p>
          <h3 className="font-mono font-bold text-[#e8e6e3] text-base truncate">
            {league.name}
          </h3>
        </div>
        <button
          onClick={onBack}
          className="font-mono text-[10px] uppercase tracking-widest text-[#5a5a64] hover:text-[#e8e6e3] transition-colors"
        >
          ← Back to leagues
        </button>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4">
        {weekOptions.map((weekId, i) => (
          <WeekPill
            key={weekId}
            active={selectedWeekId === weekId}
            label={
              i === 0
                ? "This Week"
                : formatWeekLabel(weekId).replace("Week of ", "")
            }
            onClick={() => setSelectedWeekId(weekId)}
          />
        ))}
      </div>

      <LeaderboardList
        title={formatWeekLabel(selectedWeekId)}
        rows={rows}
        loading={loading}
        error={error}
        emptyCopy="No one in this league has a score for this week yet."
        currentUid={user?.uid}
        showWeekLabel={false}
        nudge={null}
      />
    </div>
  );
}

// ── Shared row list ──────────────────────────────────────────────────

function LeaderboardList({
  title,
  rows,
  loading,
  error,
  emptyCopy,
  currentUid,
  showWeekLabel,
  nudge,
}: {
  title: string;
  rows: LineupScoreDoc[];
  loading: boolean;
  error: string | null;
  emptyCopy: string;
  currentUid: string | undefined;
  showWeekLabel: boolean;
  nudge: string | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => setExpanded(null), [rows]);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-mono font-bold text-[#e8e6e3] text-base">{title}</h3>
        <span className="font-mono text-[10px] text-[#5a5a64] uppercase tracking-widest">
          {rows.length} {rows.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {error ? (
        <div className="text-center py-12 bg-[#0e0e16] border border-[#1e1e2a] rounded-xl">
          <p className="font-mono text-sm text-red-400">{error}</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-[#0e0e16] border border-[#1e1e2a] rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 bg-[#0e0e16] border border-[#1e1e2a] rounded-xl">
          <p className="font-mono text-sm text-[#5a5a64]">{emptyCopy}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <LeaderboardRow
              key={row.id}
              rank={i + 1}
              row={row}
              highlight={currentUid === row.uid}
              expanded={expanded === row.id}
              showWeekLabel={showWeekLabel}
              onToggle={() =>
                setExpanded(expanded === row.id ? null : row.id)
              }
            />
          ))}
        </div>
      )}

      {nudge && (
        <p className="text-center font-mono text-xs text-[#5a5a64] mt-4">
          {nudge}
        </p>
      )}
    </div>
  );
}

// ── Rows ──────────────────────────────────────────────────────────────

function LeaderboardRow({
  rank,
  row,
  highlight,
  expanded,
  showWeekLabel,
  onToggle,
}: {
  rank: number;
  row: LineupScoreDoc;
  highlight: boolean;
  expanded: boolean;
  showWeekLabel: boolean;
  onToggle: () => void;
}) {
  const medal =
    rank === 1 ? "#fbbf24" : rank === 2 ? "#cbd5e1" : rank === 3 ? "#b45309" : null;
  return (
    <div
      className={`rounded-lg border transition-colors ${
        highlight
          ? "border-[#fbbf24] bg-[#fbbf24]/5"
          : "border-[#1e1e2a] bg-[#0e0e16] hover:bg-[#111118]"
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-3 text-left"
        aria-expanded={expanded}
      >
        <div
          className="font-mono font-bold text-sm w-9 text-center flex-shrink-0"
          style={{ color: medal ?? "#8a8a94" }}
        >
          {medal ? rankMedalEmoji(rank) : `#${rank}`}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-mono font-bold text-[#e8e6e3] text-sm truncate">
            {row.displayName || "Anonymous"}
            {highlight && (
              <span className="font-mono ml-2 text-[9px] text-[#fbbf24] uppercase tracking-widest">
                You
              </span>
            )}
          </div>
          <div className="font-mono text-[10px] text-[#5a5a64] truncate">
            {showWeekLabel ? `${formatWeekLabel(row.weekId)} · ` : ""}
            {summarizeLineup(row)}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="font-mono text-[9px] text-[#5a5a64] uppercase tracking-wider leading-none">
            Total
          </div>
          <div className="font-mono font-bold text-xl text-[#fbbf24] leading-tight mt-0.5">
            {row.total.toFixed(1)}
          </div>
        </div>
        <svg
          className={`w-4 h-4 flex-shrink-0 text-[#5a5a64] transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {expanded && <ExpandedBreakdown row={row} />}
    </div>
  );
}

function ExpandedBreakdown({ row }: { row: LineupScoreDoc }) {
  return (
    <div className="px-3 pb-3 pt-0">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-2 border-t border-[#1e1e2a]">
        {row.playerIds.map((pid, i) => {
          const slot = LINEUP_SLOT_POSITIONS[i];
          const entry =
            pid != null
              ? row.perPlayer.find((p) => p.playerId === pid)
              : undefined;
          return (
            <BreakdownCell
              key={i}
              slotLabel={SLOT_POSITION_LABELS[slot]}
              entry={entry}
            />
          );
        })}
      </div>
    </div>
  );
}

function BreakdownCell({
  slotLabel,
  entry,
}: {
  slotLabel: string;
  entry: PerPlayerScore | undefined;
}) {
  return (
    <div className="bg-[#111118] border border-[#1e1e2a] rounded p-2">
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#5a5a64]">
        {slotLabel}
      </div>
      {entry ? (
        <>
          <div className="font-mono font-bold text-[11px] text-[#e8e6e3] truncate mt-0.5">
            {entry.playerName}
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="font-mono text-[8px] text-[#5a5a64] uppercase">Avg</span>
            <span className="font-mono font-bold text-xs text-[#fbbf24]">
              {entry.perGameAvg.toFixed(1)}
            </span>
          </div>
          <div className="font-mono text-[8px] text-[#5a5a64] mt-0.5">
            {entry.gamesPlayed} GP
          </div>
        </>
      ) : (
        <p className="font-mono text-[10px] text-[#5a5a64] mt-1">—</p>
      )}
    </div>
  );
}

function summarizeLineup(row: LineupScoreDoc): string {
  if (row.perPlayer.length === 0) return "Lineup pending";
  return row.perPlayer
    .map((p) => p.playerName.split(" ").slice(-1)[0])
    .filter(Boolean)
    .join(" · ");
}

function rankMedalEmoji(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

// ── Controls ─────────────────────────────────────────────────────────

function ScopeTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-mono text-xs uppercase tracking-widest rounded-md border transition-colors ${
        active
          ? "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/30"
          : "bg-transparent text-[#8a8a94] border-transparent hover:text-[#e8e6e3]"
      }`}
    >
      {label}
    </button>
  );
}

function ModeTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 font-mono text-xs uppercase tracking-widest rounded-md border transition-colors ${
        active
          ? "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/30"
          : "bg-[#0e0e16] text-[#8a8a94] border-[#1e1e2a] hover:text-[#e8e6e3]"
      }`}
    >
      {label}
    </button>
  );
}

function WeekPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider rounded-md border transition-colors ${
        active
          ? "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/30"
          : "border-[#1e1e2a] text-[#8a8a94] hover:text-[#e8e6e3] hover:border-[#3a3a44]"
      }`}
    >
      {label}
    </button>
  );
}
