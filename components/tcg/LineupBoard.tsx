"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getLineup,
  getUserCards,
  saveLineup,
  LINEUP_SIZE,
  type CardDoc,
  type CardRarity,
} from "@/lib/firestore";
import { ARCHETYPE_LABELS, deriveArchetype, getRarityMeta, RARITY_TIERS } from "@/lib/tcg";
import type { Archetype } from "@/lib/firestore";
import {
  canFillSlot,
  LINEUP_SLOT_POSITIONS,
  SLOT_POSITION_LABELS,
} from "@/lib/tcg-positions";
import { PlayerCard } from "./PlayerCard";
import { ArchetypeIcon } from "./ArchetypeIcon";
import { WeeklyScorePanel } from "./WeeklyScorePanel";
import { Modal } from "@/components/ui/Modal";
import toast from "react-hot-toast";

const ARCHETYPE_FILTERS: { value: Archetype | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "scorer", label: ARCHETYPE_LABELS.scorer },
  { value: "playmaker", label: ARCHETYPE_LABELS.playmaker },
  { value: "rebounder", label: ARCHETYPE_LABELS.rebounder },
  { value: "two-way", label: ARCHETYPE_LABELS["two-way"] },
  { value: "rim-protector", label: ARCHETYPE_LABELS["rim-protector"] },
];

const RARITY_FILTERS: { value: CardRarity | ""; label: string }[] = [
  { value: "", label: "All" },
  ...RARITY_TIERS.map((t) => ({ value: t.tier, label: t.label })).reverse(),
];

function cardPower(card: CardDoc): number {
  return Math.round(card.stats.pra + card.stats.stocks * 2);
}

function cardArchetype(card: CardDoc): Archetype {
  return card.archetype ?? deriveArchetype(card.stats);
}

interface Stack {
  playerId: number;
  representative: CardDoc;
  count: number;
  foilCount: number;
}

function groupByPlayer(cards: CardDoc[]): Stack[] {
  const by = new Map<number, CardDoc[]>();
  for (const c of cards) {
    const arr = by.get(c.playerId) ?? [];
    arr.push(c);
    by.set(c.playerId, arr);
  }
  const stacks: Stack[] = [];
  for (const [playerId, copies] of by) {
    // Prefer a foil copy as the representative if one exists so the slot
    // shows the "flashier" print of the player.
    copies.sort((a, b) => {
      const foilDelta = Number(!!b.foil) - Number(!!a.foil);
      if (foilDelta !== 0) return foilDelta;
      return a.acquiredAt.toMillis() - b.acquiredAt.toMillis();
    });
    const rep = copies[0];
    const foilCount = copies.filter((c) => c.foil).length;
    stacks.push({ playerId, representative: rep, count: copies.length, foilCount });
  }
  return stacks;
}

interface LineupBoardProps {
  refreshKey?: number;
}

export function LineupBoard({ refreshKey }: LineupBoardProps) {
  const { user } = useAuth();
  const [cards, setCards] = useState<CardDoc[]>([]);
  const [lineup, setLineup] = useState<(number | null)[]>(
    Array(LINEUP_SIZE).fill(null),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [pickerRarity, setPickerRarity] = useState<CardRarity | "">("");
  const [pickerArchetype, setPickerArchetype] = useState<Archetype | "">("");

  // Load cards + lineup together. Failures are handled independently so a
  // permission-denied read on /lineups doesn't hide the user's actual cards.
  useEffect(() => {
    if (!user) {
      setCards([]);
      setLineup(Array(LINEUP_SIZE).fill(null));
      setLoading(false);
      return;
    }
    setLoading(true);
    const uid = user.uid;
    Promise.allSettled([getUserCards(uid), getLineup(uid)])
      .then(([cardsResult, lineupResult]) => {
        const loadedCards =
          cardsResult.status === "fulfilled" ? cardsResult.value : [];
        if (cardsResult.status === "rejected") {
          console.error("Failed to load cards:", cardsResult.reason);
          toast.error("Couldn't load your collection.");
        }

        let slots: (number | null)[] = Array(LINEUP_SIZE).fill(null);
        if (lineupResult.status === "fulfilled") {
          const ownedIds = new Set(loadedCards.map((c) => c.playerId));
          const posByPlayer = new Map<number, string>();
          for (const c of loadedCards) {
            if (!posByPlayer.has(c.playerId)) {
              posByPlayer.set(c.playerId, c.position ?? "");
            }
          }
          let invalidatedCount = 0;
          const cleaned = lineupResult.value.playerIds.map((id, i) => {
            if (id == null) return null;
            if (!ownedIds.has(id)) return null;
            if (!canFillSlot(posByPlayer.get(id), i)) {
              invalidatedCount += 1;
              return null;
            }
            return id;
          });
          slots = cleaned;
          const changed = cleaned.some(
            (v, i) => v !== lineupResult.value.playerIds[i],
          );
          if (changed) {
            saveLineup(uid, cleaned).catch(() => {
              // Non-fatal — lineup will re-clean on next load.
            });
          }
          if (invalidatedCount > 0) {
            toast(
              `Cleared ${invalidatedCount} slot${invalidatedCount === 1 ? "" : "s"} that didn't match the new G-G-F-F-C lineup rules.`,
              { icon: "⚠️" },
            );
          }
        } else {
          console.error("Failed to load lineup:", lineupResult.reason);
          toast.error(
            "Couldn't load your saved lineup (check Firestore rules).",
          );
        }

        setCards(loadedCards);
        setLineup(slots);
      })
      .finally(() => setLoading(false));
  }, [user, refreshKey]);

  const stacks = useMemo(() => groupByPlayer(cards), [cards]);
  const stackByPlayer = useMemo(() => {
    const m = new Map<number, Stack>();
    for (const s of stacks) m.set(s.playerId, s);
    return m;
  }, [stacks]);

  const totalPower = useMemo(() => {
    let sum = 0;
    for (const id of lineup) {
      if (id == null) continue;
      const s = stackByPlayer.get(id);
      if (s) sum += cardPower(s.representative);
    }
    return sum;
  }, [lineup, stackByPlayer]);

  const filledCount = lineup.filter((id) => id != null).length;

  const persist = useCallback(
    async (next: (number | null)[]) => {
      if (!user) return;
      setSaving(true);
      try {
        await saveLineup(user.uid, next);
      } catch (err) {
        console.error("Failed to save lineup:", err);
        toast.error("Couldn't save lineup.");
      } finally {
        setSaving(false);
      }
    },
    [user],
  );

  const assignSlot = (slotIndex: number, playerId: number) => {
    const incomingStack = stackByPlayer.get(playerId);
    if (!incomingStack) return;
    if (!canFillSlot(incomingStack.representative.position, slotIndex)) {
      toast.error(
        `That player isn't eligible for the ${SLOT_POSITION_LABELS[LINEUP_SLOT_POSITIONS[slotIndex]]} slot.`,
      );
      return;
    }
    setLineup((prev) => {
      const next = [...prev];
      const displaced = prev[slotIndex];
      const existingSlot = next.indexOf(playerId);
      if (existingSlot !== -1 && existingSlot !== slotIndex) {
        // Only swap back if the displaced player can legally fill the
        // source slot. Otherwise clear the source and move on.
        if (
          displaced != null &&
          canFillSlot(
            stackByPlayer.get(displaced)?.representative.position,
            existingSlot,
          )
        ) {
          next[existingSlot] = displaced;
        } else {
          next[existingSlot] = null;
        }
      }
      next[slotIndex] = playerId;
      void persist(next);
      return next;
    });
    setPickerSlot(null);
  };

  const clearSlot = (slotIndex: number) => {
    setLineup((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      void persist(next);
      return next;
    });
  };

  if (!user) {
    return (
      <div className="text-center py-16">
        <p className="font-mono text-sm text-[#5a5a64]">Sign in to build your lineup.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: LINEUP_SIZE }).map((_, i) => (
          <div
            key={i}
            className="aspect-2.5/4 bg-[#111118] border border-[#1e1e2a] rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (stacks.length === 0) {
    return (
      <div className="text-center py-16 bg-[#111118] border border-[#1e1e2a] rounded-2xl">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#fbbf24]/10 flex items-center justify-center">
          <span className="text-2xl">🏀</span>
        </div>
        <h3 className="font-mono font-bold text-lg text-[#e8e6e3] mb-2">
          No cards to roster yet
        </h3>
        <p className="text-sm text-[#5a5a64] max-w-md mx-auto">
          Open a pack to start collecting cards, then come back here to set your starting five.
        </p>
      </div>
    );
  }

  return (
    <div>
      <WeeklyScorePanel />

      {/* Header: total power + fill state */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5 pb-4 border-b border-[#1e1e2a]">
        <div>
          <h2 className="font-mono font-bold text-[#e8e6e3] text-lg">
            Lineup Builder
          </h2>
          <p className="font-mono text-xs text-[#5a5a64]">
            2 Guards · 2 Forwards · 1 Center · locks Monday
            {saving ? " · saving…" : ""}
          </p>
          <p className="font-mono text-xs text-[#5a5a64] mt-0.5">
            {filledCount} / {LINEUP_SIZE} slots filled
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-lg border"
          style={{
            borderColor: "#fbbf24aa",
            background: "linear-gradient(135deg, #fbbf2422, #fbbf2408)",
          }}
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#fbbf24]/80">
            Lineup PWR
          </span>
          <span className="font-mono font-bold text-2xl text-[#fbbf24]">
            {totalPower}
          </span>
        </div>
      </div>

      {/* 5-slot board */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {lineup.map((playerId, i) => {
          const slotPos = LINEUP_SLOT_POSITIONS[i];
          const slotLabel = SLOT_POSITION_LABELS[slotPos];
          const stack = playerId != null ? stackByPlayer.get(playerId) : undefined;
          if (stack) {
            const card = stack.representative;
            const meta = getRarityMeta(card.rarity);
            return (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#5a5a64]">
                    {i + 1} · {slotLabel}
                  </span>
                  <button
                    onClick={() => clearSlot(i)}
                    className="font-mono text-[9px] uppercase tracking-wider text-[#5a5a64] hover:text-red-400 transition-colors"
                    aria-label={`Clear ${slotLabel.toLowerCase()} slot`}
                  >
                    Clear
                  </button>
                </div>
                <button
                  onClick={() => setPickerSlot(i)}
                  className="block w-full text-left cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  aria-label={`Swap ${slotLabel.toLowerCase()} slot — ${card.playerName}`}
                >
                  <PlayerCard
                    playerName={card.playerName}
                    teamAbbreviation={card.teamAbbreviation}
                    position={card.position}
                    rarity={card.rarity}
                    archetype={card.archetype}
                    foil={!!card.foil}
                    stats={card.stats}
                    nbaId={card.nbaId}
                    season={card.season}
                    cardNumberSeed={card.playerId}
                  />
                </button>
                <div
                  className="text-center font-mono text-[10px] uppercase tracking-widest py-1 rounded"
                  style={{ color: meta.color, backgroundColor: `${meta.color}11` }}
                >
                  Tap to swap
                </div>
              </div>
            );
          }
          return (
            <div key={i} className="flex flex-col gap-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#5a5a64] px-1">
                {i + 1} · {slotLabel}
              </span>
              <button
                onClick={() => setPickerSlot(i)}
                className="w-full aspect-2.5/4 rounded-xl border-2 border-dashed border-[#1e1e2a] bg-[#0e0e16] flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#fbbf24]/50 hover:bg-[#111118] transition-all duration-200"
                aria-label={`Pick a ${slotLabel.toLowerCase()} for slot ${i + 1}`}
              >
                <div className="w-12 h-12 rounded-full bg-[#1e1e2a] flex items-center justify-center text-[#5a5a64] text-2xl">
                  +
                </div>
                <span className="font-mono text-[10px] text-[#5a5a64] uppercase tracking-widest">
                  Pick a {slotLabel}
                </span>
              </button>
              <div className="h-[22px]" />
            </div>
          );
        })}
      </div>

      <CardPickerModal
        open={pickerSlot !== null}
        slotIndex={pickerSlot}
        stacks={stacks}
        currentlyRostered={lineup}
        rarityFilter={pickerRarity}
        archetypeFilter={pickerArchetype}
        onRarityChange={setPickerRarity}
        onArchetypeChange={setPickerArchetype}
        onPick={assignSlot}
        onClose={() => setPickerSlot(null)}
      />
    </div>
  );
}

// ── Picker ────────────────────────────────────────────────────────────

interface CardPickerModalProps {
  open: boolean;
  slotIndex: number | null;
  stacks: Stack[];
  currentlyRostered: (number | null)[];
  rarityFilter: CardRarity | "";
  archetypeFilter: Archetype | "";
  onRarityChange: (r: CardRarity | "") => void;
  onArchetypeChange: (a: Archetype | "") => void;
  onPick: (slotIndex: number, playerId: number) => void;
  onClose: () => void;
}

function CardPickerModal({
  open,
  slotIndex,
  stacks,
  currentlyRostered,
  rarityFilter,
  archetypeFilter,
  onRarityChange,
  onArchetypeChange,
  onPick,
  onClose,
}: CardPickerModalProps) {
  const rosteredElsewhere = useMemo(() => {
    const s = new Set<number>();
    currentlyRostered.forEach((id, i) => {
      if (id != null && i !== slotIndex) s.add(id);
    });
    return s;
  }, [currentlyRostered, slotIndex]);

  const filtered = useMemo(() => {
    return stacks.filter((stack) => {
      const card = stack.representative;
      if (slotIndex != null && !canFillSlot(card.position, slotIndex)) return false;
      if (rarityFilter && card.rarity !== rarityFilter) return false;
      if (archetypeFilter && cardArchetype(card) !== archetypeFilter) return false;
      return true;
    });
  }, [stacks, slotIndex, rarityFilter, archetypeFilter]);

  // Sort by rarity (legendary first) then by power.
  const sorted = useMemo(() => {
    const rarityOrder: Record<CardRarity, number> = {
      legendary: 0,
      epic: 1,
      rare: 2,
      uncommon: 3,
      common: 4,
    };
    return filtered.slice().sort((a, b) => {
      const r =
        rarityOrder[a.representative.rarity] -
        rarityOrder[b.representative.rarity];
      if (r !== 0) return r;
      return cardPower(b.representative) - cardPower(a.representative);
    });
  }, [filtered]);

  const title =
    slotIndex != null
      ? `Pick a ${SLOT_POSITION_LABELS[LINEUP_SLOT_POSITIONS[slotIndex]]} for slot ${slotIndex + 1}`
      : "Pick starter";

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <div className="flex flex-col gap-4 max-h-[75vh]">
        {/* Filters */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="font-mono text-[10px] text-[#5a5a64] uppercase tracking-widest flex-shrink-0 mr-1">
              Rarity
            </span>
            {RARITY_FILTERS.map((f) => (
              <FilterPill
                key={`r-${f.value}`}
                active={rarityFilter === f.value}
                label={f.label}
                onClick={() => onRarityChange(f.value as CardRarity | "")}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="font-mono text-[10px] text-[#5a5a64] uppercase tracking-widest flex-shrink-0 mr-1">
              Type
            </span>
            {ARCHETYPE_FILTERS.map((f) => (
              <FilterPill
                key={`a-${f.value}`}
                active={archetypeFilter === f.value}
                label={f.label}
                icon={
                  f.value ? (
                    <ArchetypeIcon archetype={f.value} size={10} />
                  ) : undefined
                }
                onClick={() => onArchetypeChange(f.value as Archetype | "")}
              />
            ))}
          </div>
        </div>

        {/* Card list */}
        <div className="overflow-y-auto -mx-2 px-2">
          {sorted.length === 0 ? (
            <div className="text-center py-10">
              <p className="font-mono text-sm text-[#5a5a64]">
                No cards match these filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {sorted.map((stack) => (
                <PickerTile
                  key={stack.playerId}
                  stack={stack}
                  disabled={rosteredElsewhere.has(stack.playerId)}
                  onPick={() => {
                    if (slotIndex != null) onPick(slotIndex, stack.playerId);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function FilterPill({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono tracking-widest uppercase rounded-md border transition-colors ${
        active
          ? "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/30"
          : "border-[#1e1e2a] text-[#8a8a94] hover:text-[#e8e6e3] hover:border-[#3a3a44]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function PickerTile({
  stack,
  disabled,
  onPick,
}: {
  stack: Stack;
  disabled: boolean;
  onPick: () => void;
}) {
  const card = stack.representative;
  const meta = getRarityMeta(card.rarity);
  const archetype = cardArchetype(card);
  const power = cardPower(card);
  return (
    <button
      onClick={onPick}
      disabled={disabled}
      className="group relative text-left flex items-center gap-2 p-2 rounded-lg border bg-[#0e0e16] hover:bg-[#111118] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ borderColor: disabled ? "#1e1e2a" : `${meta.color}44` }}
      title={disabled ? "Already in lineup" : `Pick ${card.playerName}`}
    >
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${meta.color}33, ${meta.color}11)`,
          border: `1px solid ${meta.color}55`,
          color: meta.color,
        }}
      >
        <ArchetypeIcon archetype={archetype} size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono font-bold text-[11px] text-[#e8e6e3] truncate leading-tight">
          {card.playerName}
        </div>
        <div className="flex items-center gap-1 font-mono text-[9px] text-[#5a5a64] leading-tight">
          <span className="uppercase">{card.teamAbbreviation}</span>
          <span className="text-[#3a3a44]">·</span>
          <span style={{ color: `${meta.color}dd` }} className="uppercase">
            {meta.label}
          </span>
          {stack.count > 1 && (
            <>
              <span className="text-[#3a3a44]">·</span>
              <span className="text-[#8a8a94]">×{stack.count}</span>
            </>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-mono text-[8px] text-[#5a5a64] uppercase leading-none">
          PWR
        </div>
        <div
          className="font-mono font-bold text-xs leading-tight"
          style={{ color: meta.color }}
        >
          {power}
        </div>
      </div>
    </button>
  );
}
