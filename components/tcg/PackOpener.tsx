"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { openPack, getWallet, PACK_COST, type CardDoc } from "@/lib/firestore";
import type { GeneratedCard } from "@/lib/tcg";
import { PlayerCard } from "./PlayerCard";
import toast from "react-hot-toast";

interface PackOpenerProps {
  onPackOpened?: (cards: CardDoc[]) => void;
  onBucksChange?: (newBalance: number) => void;
}

export function PackOpener({ onPackOpened, onBucksChange }: PackOpenerProps) {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "loading" | "reveal">("idle");
  const [cards, setCards] = useState<CardDoc[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);

  const handleOpen = async () => {
    if (!user) {
      toast.error("Sign in to open packs");
      return;
    }

    setState("loading");

    try {
      // Check balance first
      const wallet = await getWallet(user.uid);
      if (wallet.bucks < PACK_COST) {
        toast.error(`You need ${PACK_COST} Bucks to open a pack. You have ${wallet.bucks}.`);
        setState("idle");
        return;
      }

      // Get randomized cards from server
      const res = await fetch("/api/tcg/open-pack", { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate pack");
      const { cards: generatedCards } = (await res.json()) as { cards: GeneratedCard[] };

      // Write to Firestore (atomic transaction)
      const result = await openPack(
        user.uid,
        generatedCards.map((c) => ({
          playerId: c.playerId,
          nbaId: c.nbaId,
          playerName: c.playerName,
          teamAbbreviation: c.teamAbbreviation,
          position: c.position,
          season: c.season,
          rarity: c.rarity,
          stats: c.stats,
          ownerId: user.uid,
        })),
      );

      setCards(result.cards);
      setRevealedCount(0);
      setState("reveal");

      // Notify parent of new balance
      const updated = await getWallet(user.uid);
      onBucksChange?.(updated.bucks);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to open pack";
      toast.error(msg);
      setState("idle");
    }
  };

  const handleCardFlip = () => {
    setRevealedCount((prev) => prev + 1);
  };

  const handleDone = () => {
    onPackOpened?.(cards);
    setCards([]);
    setState("idle");
  };

  if (state === "reveal" && cards.length > 0) {
    const allRevealed = revealedCount >= cards.length;

    return (
      <div>
        <div className="text-center mb-6">
          <h3 className="font-mono font-bold text-[#fbbf24] text-lg mb-1">
            Pack Opened!
          </h3>
          <p className="font-mono text-xs text-[#5a5a64]">
            {allRevealed
              ? "All cards revealed!"
              : `Tap each card to reveal (${revealedCount}/${cards.length})`}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {cards.map((card, i) => (
            <PlayerCard
              key={i}
              playerName={card.playerName}
              teamAbbreviation={card.teamAbbreviation}
              position={card.position}
              rarity={card.rarity}
              stats={card.stats}
              nbaId={card.nbaId}
              season={card.season}
              faceDown
              onFlip={handleCardFlip}
            />
          ))}
        </div>

        {allRevealed && (
          <div className="text-center mt-6">
            <button
              onClick={handleDone}
              className="px-6 py-2.5 bg-[#fbbf24] text-[#0a0a0f] font-mono font-bold text-sm rounded-lg hover:bg-[#f59e0b] transition-colors"
            >
              View Collection
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="inline-block bg-[#111118] border border-[#fbbf24]/20 rounded-2xl p-8 sm:p-12">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#fbbf24]/10 flex items-center justify-center">
          <span className="text-3xl">🃏</span>
        </div>
        <h3 className="font-mono font-bold text-[#e8e6e3] text-xl mb-2">
          Player Card Pack
        </h3>
        <p className="text-sm text-[#5a5a64] mb-1">
          7 random NBA player cards
        </p>
        <p className="text-sm text-[#8a8a94] mb-6">
          Rarity based on real season stats
        </p>

        <button
          onClick={handleOpen}
          disabled={state === "loading" || !user}
          className="px-6 py-3 bg-[#fbbf24] text-[#0a0a0f] font-mono font-bold rounded-lg hover:bg-[#f59e0b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state === "loading" ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-[#0a0a0f]/30 border-t-[#0a0a0f] rounded-full animate-spin" />
              Opening...
            </span>
          ) : (
            `Open Pack — ${PACK_COST} Bucks`
          )}
        </button>

        {!user && (
          <p className="font-mono text-xs text-[#5a5a64] mt-3">
            Sign in to open packs
          </p>
        )}
      </div>
    </div>
  );
}
