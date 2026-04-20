"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserCards, sellCard, getWallet, type CardDoc, type CardRarity } from "@/lib/firestore";
import { PlayerCard } from "./PlayerCard";
import { FOIL_SELL_MULTIPLIER, RARITY_TIERS, getRarityMeta } from "@/lib/tcg";
import toast from "react-hot-toast";

const RARITY_FILTERS: { value: CardRarity | ""; label: string }[] = [
  { value: "", label: "All" },
  ...RARITY_TIERS.map((t) => ({ value: t.tier, label: t.label })).reverse(),
];

const SELL_VALUE: Record<CardRarity, number> = Object.fromEntries(
  RARITY_TIERS.map((t) => [t.tier, t.sellValue]),
) as Record<CardRarity, number>;

interface CardStack {
  key: string;
  representative: CardDoc;
  copies: CardDoc[];
  foil: boolean;
  sellValue: number;
}

function stackKey(c: CardDoc): string {
  return `${c.playerId}_${c.foil ? "f" : "n"}`;
}

function groupCards(cards: CardDoc[]): CardStack[] {
  const by = new Map<string, CardDoc[]>();
  for (const c of cards) {
    const k = stackKey(c);
    const arr = by.get(k) ?? [];
    arr.push(c);
    by.set(k, arr);
  }

  const stacks: CardStack[] = [];
  for (const [key, copies] of by) {
    // Pick the oldest acquisition as the representative so the tile order is stable.
    copies.sort((a, b) => a.acquiredAt.toMillis() - b.acquiredAt.toMillis());
    const rep = copies[0];
    const base = SELL_VALUE[rep.rarity];
    stacks.push({
      key,
      representative: rep,
      copies,
      foil: !!rep.foil,
      sellValue: rep.foil ? base * FOIL_SELL_MULTIPLIER : base,
    });
  }

  // Sort: rarest first, then foils above non-foils within a rarity, then by name.
  const rarityOrder: Record<CardRarity, number> = {
    legendary: 0,
    epic: 1,
    rare: 2,
    uncommon: 3,
    common: 4,
  };
  stacks.sort((a, b) => {
    const r = rarityOrder[a.representative.rarity] - rarityOrder[b.representative.rarity];
    if (r !== 0) return r;
    if (a.foil !== b.foil) return a.foil ? -1 : 1;
    return a.representative.playerName.localeCompare(b.representative.playerName);
  });

  return stacks;
}

interface CardGridProps {
  refreshKey?: number;
  onBucksChange?: (newBalance: number) => void;
}

export function CardGrid({ refreshKey, onBucksChange }: CardGridProps) {
  const { user } = useAuth();
  const [cards, setCards] = useState<CardDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRarity, setActiveRarity] = useState<CardRarity | "">("");
  const [sellingKey, setSellingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setCards([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    getUserCards(user.uid, activeRarity ? { rarity: activeRarity } : undefined)
      .then(setCards)
      .catch((err) => {
        console.error("Failed to load cards:", err);
        setError("Failed to load collection. Please try again.");
        setCards([]);
      })
      .finally(() => setLoading(false));
  }, [user, activeRarity, refreshKey]);

  const stacks = useMemo(() => groupCards(cards), [cards]);

  const handleSell = async (stack: CardStack) => {
    if (!user || sellingKey) return;
    // Sell the oldest copy first so chronology is preserved.
    const target = stack.copies[0];
    if (!target) return;
    setSellingKey(stack.key);
    try {
      await sellCard(target.id, user.uid, stack.sellValue);
      setCards((prev) => prev.filter((c) => c.id !== target.id));
      const suffix = stack.sellValue !== 1 ? "s" : "";
      const foilTag = stack.foil ? " foil" : "";
      toast.success(
        `Sold ${target.playerName}${foilTag} for ${stack.sellValue} Buck${suffix}`,
      );
      const wallet = await getWallet(user.uid);
      onBucksChange?.(wallet.bucks);
    } catch {
      toast.error("Failed to sell card");
    } finally {
      setSellingKey(null);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-16">
        <p className="font-mono text-sm text-[#5a5a64]">Sign in to view your collection</p>
      </div>
    );
  }

  return (
    <div>
      {/* Rarity filter tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {RARITY_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActiveRarity(f.value as CardRarity | "")}
            className={`flex-shrink-0 px-3 py-1.5 text-[10px] font-mono tracking-widest uppercase rounded-md border transition-colors ${
              activeRarity === f.value
                ? "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/30"
                : "border-[#1e1e2a] text-[#8a8a94] hover:text-[#e8e6e3] hover:border-[#3a3a44]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="text-center py-16">
          <p className="font-mono text-sm text-red-400">{error}</p>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-2.5/4 bg-[#111118] border border-[#1e1e2a] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : stacks.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-mono text-sm text-[#5a5a64]">
            {activeRarity ? `No ${activeRarity} cards yet` : "No cards yet. Open a pack to start collecting!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {stacks.map((stack) => {
            const card = stack.representative;
            const meta = getRarityMeta(card.rarity);
            const count = stack.copies.length;
            const isSelling = sellingKey === stack.key;
            return (
              <div key={stack.key} className="group relative flex flex-col gap-1.5">
                {count > 1 && (
                  <div
                    className="absolute top-2 left-2 z-20 flex items-center justify-center min-w-[26px] h-[22px] px-1.5 rounded-md font-mono font-bold text-[11px] shadow-lg"
                    style={{
                      backgroundColor: "#0a0a0f",
                      border: `1px solid ${meta.color}`,
                      color: meta.color,
                    }}
                    aria-label={`${count} copies`}
                  >
                    ×{count}
                  </div>
                )}
                <PlayerCard
                  playerName={card.playerName}
                  teamAbbreviation={card.teamAbbreviation}
                  position={card.position}
                  rarity={card.rarity}
                  archetype={card.archetype}
                  foil={stack.foil}
                  stats={card.stats}
                  nbaId={card.nbaId}
                  season={card.season}
                  cardNumberSeed={card.playerId}
                />
                <button
                  onClick={() => handleSell(stack)}
                  disabled={!!sellingKey}
                  className="w-full py-1.5 font-mono text-[10px] uppercase tracking-widest rounded-lg border transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed"
                  style={{
                    borderColor: `${meta.color}55`,
                    color: meta.color,
                    backgroundColor: `${meta.color}11`,
                  }}
                >
                  {isSelling
                    ? "Selling…"
                    : `Sell 1 · ${stack.sellValue} Buck${stack.sellValue !== 1 ? "s" : ""}`}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
