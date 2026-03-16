"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { WalletDisplay } from "@/components/tcg/WalletDisplay";
import { PackOpener } from "@/components/tcg/PackOpener";
import { CardGrid } from "@/components/tcg/CardGrid";
import { PACK_COST } from "@/lib/firestore";

export default function CardsPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"collection" | "packs">("collection");
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

      {!user ? (
        <div className="text-center py-20 bg-[#111118] border border-[#1e1e2a] rounded-2xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#fbbf24]/10 flex items-center justify-center">
            <span className="text-2xl">🃏</span>
          </div>
          <h2 className="font-mono font-bold text-xl text-[#e8e6e3] mb-2">
            Sign In to Collect
          </h2>
          <p className="text-sm text-[#5a5a64] mb-6 max-w-md mx-auto">
            Earn UnOfficial Bucks by playing trivia, then open packs to collect
            NBA player cards with real stats and rarity tiers.
          </p>
          <Link
            href="/login"
            className="px-6 py-2.5 bg-[#fbbf24] text-[#0a0a0f] font-mono font-bold text-sm rounded-lg hover:bg-[#f59e0b] transition-colors"
          >
            Sign In
          </Link>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 mb-8 border-b border-[#1e1e2a]">
            <button
              onClick={() => setActiveTab("collection")}
              className={`px-4 py-2.5 font-mono text-xs tracking-widest uppercase transition-colors border-b-2 -mb-px ${
                activeTab === "collection"
                  ? "border-[#fbbf24] text-[#fbbf24]"
                  : "border-transparent text-[#5a5a64] hover:text-[#8a8a94]"
              }`}
            >
              My Collection
            </button>
            <button
              onClick={() => setActiveTab("packs")}
              className={`px-4 py-2.5 font-mono text-xs tracking-widest uppercase transition-colors border-b-2 -mb-px ${
                activeTab === "packs"
                  ? "border-[#fbbf24] text-[#fbbf24]"
                  : "border-transparent text-[#5a5a64] hover:text-[#8a8a94]"
              }`}
            >
              Open Packs
            </button>
          </div>

          {/* Tab content */}
          {activeTab === "collection" ? (
            <CardGrid refreshKey={refreshKey} onBucksChange={handleBucksChange} />
          ) : (
            <PackOpener
              onPackOpened={handlePackOpened}
              onBucksChange={handleBucksChange}
            />
          )}
        </>
      )}
    </div>
  );
}
