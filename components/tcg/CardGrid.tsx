"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserCards, type CardDoc, type CardRarity } from "@/lib/firestore";
import { PlayerCard } from "./PlayerCard";
import { RARITY_TIERS } from "@/lib/tcg";

const RARITY_FILTERS: { value: CardRarity | ""; label: string }[] = [
  { value: "", label: "All" },
  ...RARITY_TIERS.map((t) => ({ value: t.tier, label: t.label })).reverse(),
];

interface CardGridProps {
  /** Trigger a re-fetch when this value changes */
  refreshKey?: number;
}

export function CardGrid({ refreshKey }: CardGridProps) {
  const { user } = useAuth();
  const [cards, setCards] = useState<CardDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRarity, setActiveRarity] = useState<CardRarity | "">("");

  useEffect(() => {
    if (!user) {
      setCards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getUserCards(user.uid, activeRarity ? { rarity: activeRarity } : undefined)
      .then(setCards)
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, [user, activeRarity, refreshKey]);

  if (!user) {
    return (
      <div className="text-center py-16">
        <p className="font-mono text-sm text-[#5a5a64]">
          Sign in to view your collection
        </p>
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

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2.5/3.5] bg-[#111118] border border-[#1e1e2a] rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-mono text-sm text-[#5a5a64]">
            {activeRarity
              ? `No ${activeRarity} cards yet`
              : "No cards yet. Open a pack to start collecting!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {cards.map((card) => (
            <PlayerCard
              key={card.id}
              playerName={card.playerName}
              teamAbbreviation={card.teamAbbreviation}
              position={card.position}
              rarity={card.rarity}
              stats={card.stats}
            />
          ))}
        </div>
      )}
    </div>
  );
}
