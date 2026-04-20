import React from "react";
import type { Archetype } from "@/lib/firestore";

interface Props {
  archetype: Archetype;
  className?: string;
  size?: number;
}

/**
 * Monochromatic archetype glyphs. Inherit color via `currentColor` so callers
 * tint them with the rarity palette.
 */
export function ArchetypeIcon({ archetype, className, size = 16 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    className,
    xmlns: "http://www.w3.org/2000/svg",
  };

  switch (archetype) {
    case "scorer":
      // Flame — a hot scorer
      return (
        <svg {...common} fill="currentColor">
          <path d="M12.5 2c.2 2.2 0 4-1.1 5.4-.6-.7-1-1.4-1.1-2.3-1.7 1.6-3.3 3.8-3.3 6.4a5 5 0 0 0 10 0c0-2.5-1.7-4.3-3.2-6-.4.7-.7 1.3-1.3 1.9C12 5.2 12.1 3.3 12.5 2zM12 14.5c.2 1 .8 1.6 1.5 2-.1 1.3-.8 2-1.8 2.2-.7-.3-1.2-1-1.3-2 .6-.3 1.3-.9 1.6-2.2z" />
        </svg>
      );
    case "playmaker":
      // Branching arrow — a pass that splits the defense
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="4" r="1.75" fill="currentColor" />
          <path d="M12 6v4.5" />
          <path d="M12 10.5 6 18" />
          <path d="m12 10.5 6 7.5" />
          <path d="m3.5 15.5 2.5 2.5 2.5-2.5" />
          <path d="m15.5 15.5 2.5 2.5 2.5-2.5" />
        </svg>
      );
    case "rebounder":
      // Up-chevron rising off a basketball — grabbing the board
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 10 12 4l6 6" />
          <path d="M12 4v4" />
          <circle cx="12" cy="16" r="5" />
          <path d="M7 16h10M12 11v10" />
        </svg>
      );
    case "two-way":
      // Double-headed vertical arrow — impact on both ends of the floor
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3v18" />
          <path d="m7 8 5-5 5 5" />
          <path d="m7 16 5 5 5-5" />
        </svg>
      );
    case "rim-protector":
      // Shield with a basketball at center — guards the paint
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2 20 5v7c0 4.5-3.5 8.5-8 10-4.5-1.5-8-5.5-8-10V5z" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}
