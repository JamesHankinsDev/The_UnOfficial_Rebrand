"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { AuthGate } from "@/components/auth/AuthGate";
import { WalletDisplay } from "@/components/tcg/WalletDisplay";
import { PackOpener } from "@/components/tcg/PackOpener";
import { CardGrid } from "@/components/tcg/CardGrid";
import { LineupBoard } from "@/components/tcg/LineupBoard";
import { Leaderboard } from "@/components/tcg/Leaderboard";
import { PACK_COST } from "@/lib/firestore";

type CardsTab = "collection" | "lineup" | "leaderboard" | "packs";

export default function CardsPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<CardsTab>("collection");
  const [refreshKey, setRefreshKey] = useState(0);
  const [bucks, setBucks] = useState<number | undefined>(undefined);

  const handlePackOpened = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setActiveTab("collection");
  }, []);

  const handleBucksChange = useCallback((newBalance: number) => {
    setBucks(newBalance);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="font-mono text-sm text-[#5a5a64] animate-pulse">Loading...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-mono font-bold text-3xl sm:text-4xl text-[#e8e6e3]">
            Player Cards
          </h1>
          <p className="text-[#8a8a94] mt-1">
            Collect NBA player cards. Earn Bucks in{" "}
            <Link href="/trivia" className="text-[#fbbf24] hover:underline">
              Trivia
            </Link>
            , spend {PACK_COST} on a pack.
          </p>
        </div>
        {user && <WalletDisplay bucksOverride={bucks} />}
      </div>

      <AuthGate
        featureName="collection"
        icon="🃏"
        reason="Your card collection and UnOfficial Bucks balance are tied to a free account, so your packs and pulls stick around."
      >
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 border-b border-[#1e1e2a] overflow-x-auto">
          {(
            [
              { key: "collection", label: "My Collection" },
              { key: "lineup", label: "Lineup" },
              { key: "leaderboard", label: "Leaderboard" },
              { key: "packs", label: "Open Packs" },
            ] satisfies { key: CardsTab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-shrink-0 px-4 py-2.5 font-mono text-xs tracking-widest uppercase transition-colors border-b-2 -mb-px ${
                activeTab === t.key
                  ? "border-[#fbbf24] text-[#fbbf24]"
                  : "border-transparent text-[#5a5a64] hover:text-[#8a8a94]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "collection" && (
          <CardGrid refreshKey={refreshKey} onBucksChange={handleBucksChange} />
        )}
        {activeTab === "lineup" && <LineupBoard refreshKey={refreshKey} />}
        {activeTab === "leaderboard" && <Leaderboard />}
        {activeTab === "packs" && (
          <PackOpener
            onPackOpened={handlePackOpened}
            onBucksChange={handleBucksChange}
          />
        )}
      </AuthGate>
    </div>
  );
}
