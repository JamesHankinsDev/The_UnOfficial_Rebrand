import React from "react";
import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="relative w-12 h-12 mx-auto mb-6">
          <Image
            src="/logo.png"
            alt="The UnOfficial"
            fill
            className="object-contain opacity-40"
          />
        </div>
        <h1 className="font-mono font-bold text-6xl text-[#fbbf24] mb-3">
          404
        </h1>
        <p className="font-mono text-lg text-[#e8e6e3] mb-2">
          Page not found
        </p>
        <p className="text-sm text-[#5a5a64] mb-8">
          This page got traded to another franchise.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-5 py-2.5 bg-[#fbbf24] text-[#0a0a0f] font-mono font-bold text-sm rounded-lg hover:bg-[#f59e0b] transition-colors"
          >
            Go Home
          </Link>
          <Link
            href="/posts"
            className="px-5 py-2.5 border border-[#1e1e2a] text-[#8a8a94] font-mono text-sm rounded-lg hover:border-[#3a3a44] hover:text-[#e8e6e3] transition-colors"
          >
            Read Articles
          </Link>
        </div>
      </div>
    </div>
  );
}
