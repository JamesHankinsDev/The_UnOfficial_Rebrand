"use client";

import React from "react";
import type { CardRarity } from "@/lib/firestore";
import { getRarityMeta } from "@/lib/tcg";

export function RarityBadge({ rarity }: { rarity: CardRarity }) {
  const meta = getRarityMeta(rarity);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-widest border"
      style={{
        color: meta.color,
        borderColor: `${meta.color}40`,
        backgroundColor: `${meta.color}10`,
      }}
    >
      {meta.label}
    </span>
  );
}
