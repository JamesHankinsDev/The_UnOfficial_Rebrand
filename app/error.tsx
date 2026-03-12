"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="font-mono font-bold text-4xl text-[#ef4444] mb-3">
          Something went wrong
        </h1>
        <p className="text-sm text-[#5a5a64] mb-2">
          {error.message || "An unexpected error occurred."}
        </p>
        {error.digest && (
          <p className="text-xs text-[#3a3a44] font-mono mb-8">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-[#fbbf24] text-[#0a0a0f] font-mono font-bold text-sm rounded-lg hover:bg-[#f59e0b] transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
