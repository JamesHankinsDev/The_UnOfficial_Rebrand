"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserCards, sellCard, getWallet, type CardDoc, type CardRarity } from "@/lib/firestore";
import { PlayerCard } from "./PlayerCard";
import { RARITY_TIERS, getRarityMeta } from "@/lib/tcg";
import toast from "react-hot-toast";

const RARITY_FILTERS: { value: CardRarity | ""; label: string }[] = [
  { value: "", label: "All" },
  ...RARITY_TIERS.map((t) => ({ value: t.tier, label: t.label })).reverse(),
];

const SELL_VALUE: Record<CardRarity, number> = Object.fromEntries(
  RARITY_TIERS.map((t) => [t.tier, t.sellValue]),
) as Record<CardRarity, number>;

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
  const [selling, setSelling] = useState<string | null>(null);

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

  const handleSell = async (card: CardDoc) => {
    if (!user || selling) return;
    const value = SELL_VALUE[card.rarity];
    setSelling(card.id);
    try {
      await sellCard(card.id, user.uid, value);
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      toast.success(`Sold ${card.playerName} for ${value} Buck${value !== 1 ? "s" : ""}`);
      const wallet = await getWallet(user.uid);
      onBucksChange?.(wallet.bucks);
    } catch {
      toast.error("Failed to sell card");
    } finally {
      setSelling(null);
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
      ) : cards.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-mono text-sm text-[#5a5a64]">
            {activeRarity ? `No ${activeRarity} cards yet` : "No cards yet. Open a pack to start collecting!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {cards.map((card) => {
            const meta = getRarityMeta(card.rarity);
            const value = SELL_VALUE[card.rarity];
            const isSelling = selling === card.id;
            return (
              <div key={card.id} className="group relative flex flex-col gap-1.5">
                <PlayerCard
                  playerName={card.playerName}
                  teamAbbreviation={card.teamAbbreviation}
                  position={card.position}
                  rarity={card.rarity}
                  stats={card.stats}
                  nbaId={card.nbaId}
                  season={card.season}
                />
                <button
                  onClick={() => handleSell(card)}
                  disabled={!!selling}
                  className="w-full py-1.5 font-mono text-[10px] uppercase tracking-widest rounded-lg border transition-all duration-200 opacity-0 group-hover:opacity-100 disabled:cursor-not-allowed"
                  style={{
                    borderColor: `${meta.color}55`,
                    color: meta.color,
                    backgroundColor: `${meta.color}11`,
                  }}
                >
                  {isSelling ? "Selling…" : `Sell · ${value} Buck${value !== 1 ? "s" : ""}`}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
