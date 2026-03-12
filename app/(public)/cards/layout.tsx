import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Player Cards",
  description:
    "Collect NBA player cards on The UnOfficial. Earn Bucks in trivia, open packs, and build your collection with real stats and rarity tiers.",
};

export default function CardsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
