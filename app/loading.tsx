import React from "react";

export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#fbbf24]/30 border-t-[#fbbf24] rounded-full animate-spin" />
        <span className="font-mono text-xs text-[#5a5a64] tracking-widest uppercase">
          Loading
        </span>
      </div>
    </div>
  );
}
