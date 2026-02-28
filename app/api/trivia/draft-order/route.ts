import { NextResponse } from "next/server";
import { getApi } from "@/lib/balldontlie";

export interface TriviaPlayer {
  id: number;
  name: string;
  team: string;
  position: string;
  draftYear: number;
  draftRound: number;
  draftNumber: number;
}

// In-memory cache to avoid burning rate-limited API calls
let cachedPlayers: TriviaPlayer[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function fetchDraftedPlayers(): Promise<TriviaPlayer[]> {
  const api = getApi();

  // Fetch a single page of 100 players. Randomize the starting cursor
  // so we get different slices of the player database on each cache refresh.
  const randomCursor = Math.floor(Math.random() * 3000) + 1;

  const res = await api.nba.getPlayers({
    per_page: 100,
    cursor: randomCursor,
  });

  const players: TriviaPlayer[] = [];

  for (const p of res.data) {
    if (
      p.draft_number != null &&
      p.draft_year != null &&
      p.draft_round != null
    ) {
      players.push({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        team: p.team?.full_name ?? "Unknown",
        position: p.position || "N/A",
        draftYear: p.draft_year,
        draftRound: p.draft_round,
        draftNumber: p.draft_number,
      });
    }
  }

  return players;
}

function pickRandomPlayers(
  pool: TriviaPlayer[],
  count: number,
): TriviaPlayer[] {
  // Shuffle and pick players with unique draft numbers
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked: TriviaPlayer[] = [];
  const usedDraftNumbers = new Set<number>();

  for (const player of shuffled) {
    if (usedDraftNumbers.has(player.draftNumber)) continue;
    usedDraftNumbers.add(player.draftNumber);
    picked.push(player);
    if (picked.length >= count) break;
  }

  return picked;
}

export async function GET() {
  try {
    const now = Date.now();

    // Refresh cache if expired or empty
    if (cachedPlayers.length === 0 || now - cacheTimestamp > CACHE_TTL) {
      cachedPlayers = await fetchDraftedPlayers();
      cacheTimestamp = now;
    }

    if (cachedPlayers.length < 5) {
      return NextResponse.json(
        { error: "Not enough drafted players available" },
        { status: 503 },
      );
    }

    const players = pickRandomPlayers(cachedPlayers, 5);

    // Return players without draft info exposed (client shouldn't see answers)
    const clientPlayers = players.map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      position: p.position,
    }));

    // Answers keyed by player ID
    const answers = Object.fromEntries(
      players.map((p) => [
        p.id,
        {
          draftNumber: p.draftNumber,
          draftYear: p.draftYear,
          draftRound: p.draftRound,
        },
      ]),
    );

    return NextResponse.json({ players: clientPlayers, answers });
  } catch (error) {
    console.error("Draft order trivia error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trivia data" },
      { status: 500 },
    );
  }
}
