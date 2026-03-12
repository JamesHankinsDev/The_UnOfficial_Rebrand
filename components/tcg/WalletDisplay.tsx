"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getWallet } from "@/lib/firestore";

interface WalletDisplayProps {
  /** Optional override for when bucks change without re-fetch */
  bucksOverride?: number;
  className?: string;
}

export function WalletDisplay({ bucksOverride, className = "" }: WalletDisplayProps) {
  const { user } = useAuth();
  const [bucks, setBucks] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setBucks(null);
      return;
    }
    getWallet(user.uid).then((w) => setBucks(w.bucks));
  }, [user]);

  useEffect(() => {
    if (bucksOverride !== undefined) setBucks(bucksOverride);
  }, [bucksOverride]);

  if (!user || bucks === null) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#111118] border border-[#fbbf24]/20 rounded-lg ${className}`}
    >
      <span className="text-[#fbbf24] text-sm">$</span>
      <span className="font-mono font-bold text-[#fbbf24] text-sm">{bucks}</span>
      <span className="font-mono text-[10px] text-[#5a5a64] uppercase tracking-widest ml-0.5">
        Bucks
      </span>
    </div>
  );
}
