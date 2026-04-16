import type { PlayerSnapshot } from "../balldontlie";
import type { BriefContent } from "../firestore";
import {
  generateBrief,
  buildSnapshotPayload,
  JSON_SCHEMA_INSTRUCTION,
} from "./shared";

const SYSTEM_PROMPT = `You are the data engine for The UnOfficial's Wednesday Mix Tape column.

Scan the last 4 days of NBA action and surface 5 candidates for "tracks" — each must be a discrete, self-contained observation. Look specifically for:
- Stat line anomalies: a player significantly over or under their season averages (>1.5 standard deviations)
- Narrative contradictions: a team winning despite bad underlying numbers, or losing despite good ones
- Quiet trends: a player whose last 5 games suggest a role change, usage shift, or breakout forming
- Pace and efficiency outliers: any game where the final score wildly misrepresents the actual quality of play
- Scheduling quirks: back-to-backs, 4-games-in-5-nights stretches affecting performance

Flag any coaching or lineup changes the writer should verify — note where the data suggests something shifted but you can't confirm from stats alone.

${JSON_SCHEMA_INSTRUCTION}`;

export async function generateMixTapeBrief(
  snapshots: PlayerSnapshot[],
): Promise<BriefContent> {
  const today = new Date().toISOString().split("T")[0];

  return generateBrief({
    systemPrompt: SYSTEM_PROMPT,
    snapshots,
    userMessage: `Today is ${today} (Wednesday — Mix Tape day).

Here is the last 7 days of NBA player data, already filtered to qualifying rotation players (≥15 MPG, ≥3 GP) and ranked by PRA:

\`\`\`json
${buildSnapshotPayload(snapshots)}
\`\`\`

Return the Mix Tape brief as specified. Focus on the most electric stat lines and flag any context the writer should verify (injuries, milestone proximity).`,
  });
}
