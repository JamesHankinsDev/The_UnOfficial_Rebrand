"use client";

import React, { useEffect, useState } from "react";
import {
  getLatestBrief,
  getLatestBriefForType,
  type BriefArticleType,
  type BriefDoc,
  type ValuePlay,
} from "@/lib/firestore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

// ── Tab config ──────────────────────────────────────────────────────────────

type BadgeVariant = "gold" | "orange" | "green" | "blue";

interface BriefTab {
  type: BriefArticleType;
  label: string;
  badge: BadgeVariant;
  schedule: string;
  color: string;
  playsLabel: string;
  spirit: string;
}

const TABS: BriefTab[] = [
  {
    type: "value_meal",
    label: "Value Meal",
    badge: "gold",
    schedule: "Every Monday",
    color: "#fbbf24",
    playsLabel: "Top Value Plays",
    spirit: `Find the most underpriced player in the league right now. One subject, one thesis, one number that tells the whole story. PRA/CAP% is your lens — who is delivering All-Star output at a fraction of the cost? Ground it in the data, contextualize it against history, and connect it to why it matters for their team's construction. Medium length, data-forward, one clear argument.`,
  },
  {
    type: "mix_tape",
    label: "Mix Tape",
    badge: "blue",
    schedule: "Every Wednesday",
    color: "#3b82f6",
    playsLabel: "Top Performances",
    spirit:
      "Three to five short tracks — no single thesis required. Point at the interesting things from the last few days: the weird stat line, the team trend nobody's talking about, the narrative that contradicts the box score. Each track stands alone. Punchy, smart, a little irreverent. You're a DJ, not a lecturer.",
  },
  {
    type: "residue",
    label: "Residue",
    badge: "green",
    schedule: "Every Friday",
    color: "#10b981",
    playsLabel: "Under the Radar",
    spirit:
      "The long-form essay. One subject, examined slowly. Pick a player, a team, a moment, or a trend from the week and go deep. This isn't news — it's what the news means. Extended metaphors welcome. Digressions that earn their length welcome. Genuine feeling about the game welcome. Give the reader something they couldn't get from a box score or a beat reporter.",
  },
  {
    type: "picks_pops_rolls",
    label: "Picks, Pops & Rolls",
    badge: "orange",
    schedule: "1st Friday of the Month",
    color: "#f97316",
    playsLabel: "Key Plays",
    spirit:
      "Three calls, one of each. A Pick is what you're backing this weekend — a player, a prop, a narrative bet. A Pop is the surprise worth watching, the thing most people are sleeping on. A Roll is the disappointment coming that nobody sees yet. Forward-looking, opinionated, accountable. You're putting a stake in the ground — own it.",
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatPct(n: number | null): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function formatSalary(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${(n / 1_000).toFixed(0)}K`;
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function BriefPage() {
  const [activeTab, setActiveTab] = useState<BriefArticleType | null>(null);
  const [brief, setBrief] = useState<BriefDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [expandedPlay, setExpandedPlay] = useState<ValuePlay | null>(null);
  const [expansionText, setExpansionText] = useState("");
  const [expansionLoading, setExpansionLoading] = useState(false);
  const [expansionError, setExpansionError] = useState("");

  const tab = TABS.find((t) => t.type === activeTab) ?? TABS[0];

  // On first load, fetch the most recent brief across all types and set the tab to match.
  useEffect(() => {
    getLatestBrief()
      .then((b) => {
        if (b) {
          setBrief(b);
          setActiveTab(b.articleType);
        } else {
          setActiveTab("value_meal");
        }
      })
      .catch(() => {
        setActiveTab("value_meal");
        setError("Could not load the brief. Try refreshing.");
      })
      .finally(() => {
        setLoading(false);
        setInitialized(true);
      });
  }, []);

  // When the user clicks a different tab, fetch that type's latest brief.
  // Skip if the initial load already provided the right brief.
  useEffect(() => {
    if (!initialized || activeTab == null) return;
    if (brief?.articleType === activeTab) return;
    setLoading(true);
    setError("");
    setBrief(null);
    getLatestBriefForType(activeTab)
      .then(setBrief)
      .catch(() => setError("Could not load the brief. Try refreshing."))
      .finally(() => setLoading(false));
  }, [activeTab, initialized]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openExpand(play: ValuePlay) {
    setExpandedPlay(play);
    setExpansionText("");
    setExpansionError("");
    setExpansionLoading(true);

    try {
      const res = await fetch("/api/generate-brief/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          play,
          surroundingContext: brief?.content.narrativeHook ?? "",
          briefType: tab.label,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const body = await res.json();
      setExpansionText(body.text ?? "");
    } catch (err) {
      setExpansionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setExpansionLoading(false);
    }
  }

  function closeExpand() {
    setExpandedPlay(null);
    setExpansionText("");
    setExpansionError("");
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-mono font-bold text-2xl text-[#e8e6e3] mb-1">
          Morning Brief
        </h1>
        <p className="text-sm text-[#5a5a64] font-mono">
          Auto-generated from the last 7 days of game logs.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-8 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.type}
            onClick={() => setActiveTab(t.type)}
            className={`px-4 py-2 text-sm font-mono font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === t.type
                ? "text-[#0a0a0f]"
                : "text-[#8a8a94] hover:text-[#e8e6e3] bg-[#111118] hover:bg-[#1e1e2a]"
            }`}
            style={
              activeTab === t.type ? { backgroundColor: t.color } : undefined
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Schedule tag + spirit */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Badge variant={tab.badge}>{tab.label}</Badge>
          <span className="text-xs font-mono text-[#5a5a64] uppercase tracking-widest">
            {tab.schedule}
          </span>
        </div>
        <p className="text-sm text-[#8a8a94] max-w-2xl leading-relaxed">
          {tab.spirit}
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState title="Something went wrong" body={error} />
      ) : !brief ? (
        <EmptyState
          title="No brief yet"
          body={`The ${tab.label} brief hasn't been generated yet. It will appear here after the next scheduled run.`}
        />
      ) : (
        <BriefView brief={brief} tab={tab} onExpand={openExpand} />
      )}

      {/* Expand modal */}
      <Modal
        open={expandedPlay != null}
        onClose={closeExpand}
        title={expandedPlay ? `${expandedPlay.playerName} — Deep Read` : ""}
      >
        {expansionLoading ? (
          <div className="py-8 text-center font-mono text-sm text-[#5a5a64] animate-pulse">
            Claude is writing…
          </div>
        ) : expansionError ? (
          <div className="py-4 font-mono text-sm text-red-400">
            {expansionError}
          </div>
        ) : (
          <div className="whitespace-pre-wrap text-sm text-[#e8e6e3] leading-relaxed max-h-[60vh] overflow-y-auto">
            {expansionText}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-24 bg-[#111118] border border-[#1e1e2a] rounded-xl animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 bg-[#111118] border border-[#1e1e2a] rounded-xl animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-[#1e1e2a] bg-[#111118] rounded-xl p-10 text-center">
      <div className="font-mono text-[#e8e6e3] text-sm mb-2">{title}</div>
      <p className="text-sm text-[#5a5a64] font-mono max-w-md mx-auto">
        {body}
      </p>
    </div>
  );
}

function BriefView({
  brief,
  tab,
  onExpand,
}: {
  brief: BriefDoc;
  tab: BriefTab;
  onExpand: (play: ValuePlay) => void;
}) {
  const generatedDate = brief.generatedAt.toDate();
  const generatedLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(generatedDate);

  return (
    <div className="space-y-8">
      {/* Narrative hook */}
      <section
        className="rounded-xl p-6 border"
        style={{
          borderColor: `${tab.color}4D`,
          background: `linear-gradient(to bottom right, ${tab.color}0D, transparent)`,
        }}
      >
        <div
          className="text-xs font-mono uppercase tracking-widest mb-3"
          style={{ color: tab.color }}
        >
          Narrative hook
        </div>
        <p className="text-lg text-[#e8e6e3] leading-relaxed">
          {brief.content.narrativeHook}
        </p>
        <div className="text-xs font-mono text-[#5a5a64] mt-4">
          Generated {generatedLabel} ET
        </div>
      </section>

      {/* Plays */}
      <section>
        <h2 className="font-mono font-bold text-sm text-[#e8e6e3] uppercase tracking-widest mb-3">
          {tab.playsLabel}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {brief.content.topValuePlays.map((play, i) => (
            <PlayCard
              key={`${play.playerId}-${i}`}
              play={play}
              tab={tab}
              onExpand={() => onExpand(play)}
            />
          ))}
        </div>
      </section>

      {/* Data anomalies */}
      {brief.content.dataAnomalies.length > 0 && (
        <section>
          <h2 className="font-mono font-bold text-sm text-[#e8e6e3] uppercase tracking-widest mb-3">
            Data Anomalies
          </h2>
          <ul className="border border-[#1e1e2a] bg-[#111118] rounded-xl divide-y divide-[#1e1e2a]">
            {brief.content.dataAnomalies.map((item, i) => (
              <li
                key={i}
                className="px-4 py-3 text-sm text-[#e8e6e3] font-mono flex gap-3"
              >
                <span style={{ color: tab.color }}>▸</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tweetable blurbs */}
      {brief.content.tweetableBlurbs?.length > 0 && (
        <section>
          <h2 className="font-mono font-bold text-sm text-[#e8e6e3] uppercase tracking-widest mb-3">
            Tweetable Blurbs
          </h2>
          <div className="space-y-2">
            {brief.content.tweetableBlurbs.map((blurb, i) => (
              <div
                key={i}
                className="border border-[#1e1e2a] bg-[#111118] rounded-xl p-4 flex items-start gap-3 group"
              >
                <span
                  className="text-xs font-mono font-bold mt-0.5 shrink-0"
                  style={{ color: tab.color }}
                >
                  {i + 1}.
                </span>
                <p className="text-sm text-[#e8e6e3] leading-relaxed flex-1">
                  {blurb}
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(blurb);
                  }}
                  className="text-xs font-mono text-[#5a5a64] hover:text-[#e8e6e3] transition-colors opacity-0 group-hover:opacity-100 shrink-0 cursor-pointer"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Injury context */}
      <section>
        <h2 className="font-mono font-bold text-sm text-[#e8e6e3] uppercase tracking-widest mb-3">
          Injury Context
        </h2>
        <div className="border border-[#1e1e2a] bg-[#111118] rounded-xl p-5">
          <p className="text-sm text-[#e8e6e3] leading-relaxed">
            {brief.content.injuryContext}
          </p>
        </div>
      </section>
    </div>
  );
}

function PlayCard({
  play,
  tab,
  onExpand,
}: {
  play: ValuePlay;
  tab: BriefTab;
  onExpand: () => void;
}) {
  return (
    <div
      className="border border-[#1e1e2a] bg-[#111118] rounded-xl p-5 flex flex-col gap-3 transition-colors"
      style={{ ["--hover-border" as string]: `${tab.color}66` }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = `${tab.color}66`)
      }
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e2a")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono font-bold text-[#e8e6e3]">
            {play.playerName}
          </div>
          <div className="font-mono text-xs text-[#5a5a64] uppercase tracking-widest">
            {play.team}
          </div>
        </div>
        <Badge variant={tab.badge}>{play.pra.toFixed(1)} PRA</Badge>
      </div>

      <div className="flex items-center gap-4 text-xs font-mono">
        <div>
          <div className="text-[#5a5a64] uppercase tracking-widest">Cap %</div>
          <div className="text-[#e8e6e3]">{formatPct(play.capPct)}</div>
        </div>
        <div>
          <div className="text-[#5a5a64] uppercase tracking-widest">Salary</div>
          <div className="text-[#e8e6e3]">{formatSalary(play.salary)}</div>
        </div>
      </div>

      {play.contextNote && (
        <p className="text-xs text-[#8a8a94] leading-relaxed">
          {play.contextNote}
        </p>
      )}

      <Button
        variant="secondary"
        size="sm"
        className="mt-auto"
        onClick={onExpand}
      >
        Expand this angle →
      </Button>
    </div>
  );
}
