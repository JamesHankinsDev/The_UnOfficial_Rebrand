import { NextResponse } from "next/server";
import { getApi } from "@/lib/balldontlie";
import { cached, TTL } from "@/lib/api-cache";

export interface TriviaPlayer {
  id: number;
  name: string;
  team: string;
  position: string;
  draftYear: number;
  draftRound: number;
  draftNumber: number;
}

async function fetchDraftedPlayers(): Promise<TriviaPlayer[]> {
  const api = getApi();

  // Fetch all active players (paginate through ~500 total)
  const all: TriviaPlayer[] = [];
  let cursor: number | undefined;

  do {
    const res = await api.nba.getActivePlayers({
      per_page: 100,
      ...(cursor ? { cursor } : {}),
    });

    for (const p of res.data) {
      if (
        p.draft_number != null &&
        p.draft_year != null &&
        p.draft_round != null
      ) {
        all.push({
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

    cursor = res.meta?.next_cursor ?? undefined;
  } while (cursor);

  return all;
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
    const pool = await cached("trivia-players", TTL.DAY, fetchDraftedPlayers);

    if (pool.length < 5) {
      return NextResponse.json(
        { error: "Not enough drafted players available" },
        { status: 503 },
      );
    }

    const players = pickRandomPlayers(pool, 5);

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
