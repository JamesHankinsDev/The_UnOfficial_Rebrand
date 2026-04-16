import type { PlayerSnapshot } from "../balldontlie";
import type { BriefContent } from "../firestore";
import {
  callGenerator,
  buildSnapshotPayload,
  validateResidueBrief,
} from "./shared";

const RESIDUE_SCHEMA = `Return your analysis strictly as a JSON object wrapped in a \`\`\`json fenced code block, matching this shape:

{
  "narrativeHook": "string — the punchy opening line or two that frames the week",
  "residueItems": [
    {
      "category": "player | team | coaching | trend | league",
      "title": "string — a short, punchy headline for this item",
      "subject": "string — the player name, team name, coach, or topic",
      "team": "string (3-letter abbr) | null",
      "contextNote": "string — 2-3 sentences on WHY this matters and what the writer should dig into",
      "dataPoint": "string | null — the key stat, number, or comparison that anchors this item",
      "playerId": "number | null — if this is a player item, match an id from the input data"
    }
  ],
  "dataAnomalies": [
    "string — each item is a short note about something statistically weird or worth flagging"
  ],
  "injuryContext": "string — a short paragraph summarizing who's out and how it changes the picture",
  "tweetableBlurbs": [
    "string — a tweet-length (≤280 chars) teaser the writer could post to promote the article"
  ]
}

Rules:
- residueItems must contain 10-15 items, sorted by narrative richness (best essay material first).
- Each item must have a category: "player" for individual performances, "team" for team-level observations, "coaching" for scheme/rotation/decision stories, "trend" for multi-game or multi-team patterns, "league" for CBA, scheduling, awards, or league-wide news.
- Aim for variety: no more than half the items should be "player" category. Surface coaching, team, trend, and league items.
- playerId must match an id from the input data exactly when category is "player" — use null for non-player items.
- tweetableBlurbs must contain 3-5 items, each ≤280 characters.
- Do not output anything outside the fenced JSON block.`;

const SYSTEM_PROMPT = `You are the research engine for The UnOfficial's Friday Residue column.

The Residue is the long-form essay — it picks one subject from the week and examines it slowly. Your job is to surface 10 to 15 candidates for that subject. Cast a WIDE net beyond individual players. The writer wants to see:

PLAYER items — A player at a crossroads, on a heater, in a slump, or whose numbers tell a story the mainstream isn't covering. Look for performances that contradict the narrative, statistical outliers (>1.5 SD from season avg), or players whose last 5 games suggest something is shifting.

TEAM items — A team whose results don't match their underlying numbers (winning ugly or losing well), a roster construction that's working or failing in surprising ways, a team that's quietly become the best/worst at something specific.

COACHING items — A rotation change that's paying off or backfiring, a scheme adjustment visible in the data (pace change, shot profile shift, defensive rating swing), a coaching decision that deserves scrutiny.

TREND items — Multi-team or multi-game patterns: a position archetype that's thriving/dying, a statistical trend across the league, a shift in how the game is being played this week vs. the season average.

LEAGUE items — CBA implications, scheduling quirks affecting outcomes, award race shifts, trade deadline fallout, draft positioning dynamics, anything happening at the league level that intersects with on-court play.

Prioritize subjects where the statistics tell a story that contradicts or complicates the mainstream narrative, where there's a historical parallel worth drawing, or where there's genuine tension the writer can explore.

${RESIDUE_SCHEMA}`;

export async function generateResidueBrief(
  snapshots: PlayerSnapshot[],
): Promise<BriefContent> {
  const today = new Date().toISOString().split("T")[0];

  const parsed = await callGenerator({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Today is ${today} (Friday — Residue day).

Here is the last 7 days of NBA player data, already filtered to qualifying rotation players (≥15 MPG, ≥3 GP) and ranked by PRA:

\`\`\`json
${buildSnapshotPayload(snapshots)}
\`\`\`

Return the Residue brief as specified. Go BEYOND just the player data — use the stats to identify team-level patterns, coaching trends, and league-wide stories. The player data is your starting point, not your boundary. Flag any storylines the writer should verify with current news.`,
  });

  return validateResidueBrief(parsed);
}
