import type { CardRarity } from "./firestore";

// --- Rarity Tiers ---

export const RARITY_TIERS: {
  tier: CardRarity;
  label: string;
  minPercentile: number;
  color: string;
  glowColor: string;
}[] = [
  { tier: "legendary", label: "Legendary", minPercentile: 97, color: "#fbbf24", glowColor: "rgba(251,191,36,0.4)" },
  { tier: "epic", label: "Epic", minPercentile: 90, color: "#8b5cf6", glowColor: "rgba(139,92,246,0.4)" },
  { tier: "rare", label: "Rare", minPercentile: 75, color: "#3b82f6", glowColor: "rgba(59,130,246,0.4)" },
  { tier: "uncommon", label: "Uncommon", minPercentile: 50, color: "#10b981", glowColor: "rgba(16,185,129,0.4)" },
  { tier: "common", label: "Common", minPercentile: 0, color: "#6b7280", glowColor: "rgba(107,114,128,0.3)" },
];

// Pack odds (out of 100) — cumulative thresholds
const PACK_ODDS: { tier: CardRarity; cumulativeMax: number }[] = [
  { tier: "common", cumulativeMax: 45 },
  { tier: "uncommon", cumulativeMax: 70 },
  { tier: "rare", cumulativeMax: 88 },
  { tier: "epic", cumulativeMax: 97 },
  { tier: "legendary", cumulativeMax: 100 },
];

export function getRarityMeta(rarity: CardRarity) {
  return RARITY_TIERS.find((t) => t.tier === rarity) ?? RARITY_TIERS[4];
}

export function assignRarity(percentile: number): CardRarity {
  for (const tier of RARITY_TIERS) {
    if (percentile >= tier.minPercentile) return tier.tier;
  }
  return "common";
}

function rollRarity(): CardRarity {
  const roll = Math.floor(Math.random() * 100);
  for (const { tier, cumulativeMax } of PACK_ODDS) {
    if (roll < cumulativeMax) return tier;
  }
  return "common";
}

// --- Player Pool ---

export interface PoolPlayer {
  playerId: number;
  nbaId?: number;
  firstName: string;
  lastName: string;
  position: string;
  teamAbbreviation: string;
  season: number;
  stats: {
    pts: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    pra: number;
    stocks: number;
  };
  compositeScore: number;
  percentile: number;
  rarity: CardRarity;
}

/**
 * Takes raw season averages from the BallDontLie API, computes composite
 * scores, assigns percentiles and rarity tiers.
 */
export function buildPlayerPool(
  players: {
    player_id: number;
    nba_id?: number;
    first_name: string;
    last_name: string;
    position: string;
    team_abbreviation: string;
    season: number;
    pts: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    games_played: number;
  }[],
): PoolPlayer[] {
  // Filter out players with too few games
  const eligible = players.filter((p) => p.games_played >= 10);

  // Compute composite scores: PRA + (STOCKs * 2)
  const withScores = eligible.map((p) => {
    const pra = p.pts + p.reb + p.ast;
    const stocks = p.stl + p.blk;
    return {
      playerId: p.player_id,
      nbaId: p.nba_id,
      firstName: p.first_name,
      lastName: p.last_name,
      position: p.position,
      teamAbbreviation: p.team_abbreviation,
      season: p.season,
      stats: {
        pts: round1(p.pts),
        reb: round1(p.reb),
        ast: round1(p.ast),
        stl: round1(p.stl),
        blk: round1(p.blk),
        pra: round1(pra),
        stocks: round1(stocks),
      },
      compositeScore: pra + stocks * 2,
      percentile: 0,
      rarity: "common" as CardRarity,
    };
  });

  // Sort ascending by composite score and assign percentiles
  withScores.sort((a, b) => a.compositeScore - b.compositeScore);
  const total = withScores.length;
  for (let i = 0; i < total; i++) {
    const percentile = Math.round((i / (total - 1)) * 100);
    withScores[i].percentile = percentile;
    withScores[i].rarity = assignRarity(percentile);
  }

  return withScores;
}

// --- Pack Generation ---

export interface GeneratedCard {
  playerId: number;
  nbaId?: number;
  playerName: string;
  teamAbbreviation: string;
  position: string;
  season: number;
  rarity: CardRarity;
  stats: PoolPlayer["stats"];
}

/**
 * Generate 7 cards for a pack from the player pool.
 * Guarantees at least 1 uncommon or better.
 */
export function generatePack(pool: PoolPlayer[], count = 7): GeneratedCard[] {
  // Group pool by rarity
  const byRarity = new Map<CardRarity, PoolPlayer[]>();
  for (const p of pool) {
    const list = byRarity.get(p.rarity) || [];
    list.push(p);
    byRarity.set(p.rarity, list);
  }

  const cards: GeneratedCard[] = [];
  const usedIds = new Set<number>();

  for (let i = 0; i < count; i++) {
    let rarity = rollRarity();

    // Ensure at least 1 uncommon+ on last card if all common so far
    if (i === count - 1 && cards.every((c) => c.rarity === "common")) {
      if (rarity === "common") rarity = "uncommon";
    }

    // Fallback to adjacent tier if rolled tier has no available players
    let tierPlayers = (byRarity.get(rarity) || []).filter((p) => !usedIds.has(p.playerId));
    if (tierPlayers.length === 0) {
      // Try tiers from rarest to most common
      for (const { tier } of RARITY_TIERS) {
        tierPlayers = (byRarity.get(tier) || []).filter((p) => !usedIds.has(p.playerId));
        if (tierPlayers.length > 0) {
          rarity = tier;
          break;
        }
      }
    }

    if (tierPlayers.length === 0) break; // exhausted entire pool (shouldn't happen)

    const pick = tierPlayers[Math.floor(Math.random() * tierPlayers.length)];
    usedIds.add(pick.playerId);

    cards.push({
      playerId: pick.playerId,
      nbaId: pick.nbaId,
      playerName: `${pick.firstName} ${pick.lastName}`,
      teamAbbreviation: pick.teamAbbreviation,
      position: pick.position,
      season: pick.season,
      rarity,
      stats: pick.stats,
    });
  }

  return cards;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
