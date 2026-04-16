import type { PlayerSnapshot } from "../balldontlie";
import type { BriefContent } from "../firestore";
import {
  generateBrief,
  buildSnapshotPayload,
  jsonSchemaInstruction,
} from "./shared";

export { expandPlay as expandValuePlay } from "./shared";

const SYSTEM_PROMPT = `You are the data engine for The UnOfficial's Monday Morning Value Meal column.

Surface the top value plays from the last 7 days using PRA/CAP% as the primary lens (current salary cap: $154.6M). For each candidate:
- Calculate PRA (pts + reb + ast) from the last 7 days and season averages
- Calculate PRA/CAP% (PRA divided by player salary as % of cap)
- Flag if the player is on a rookie deal, extension year, or expiring contract
- Note any recent performance trend (last 3 games vs season average)
- Surface one historical comparison if PRA/CAP% is in the top 10 of the last 5 seasons

Flag if the player's injury status or any recent transaction news might affect this analysis — the writer will verify before publishing.

${jsonSchemaInstruction()}`;

export async function generateValueMealBrief(
  snapshots: PlayerSnapshot[],
): Promise<BriefContent> {
  const today = new Date().toISOString().split("T")[0];

  return generateBrief({
    systemPrompt: SYSTEM_PROMPT,
    snapshots,
    userMessage: `Today is ${today}.

Here is the last 7 days of NBA player data, already filtered to qualifying rotation players (≥15 MPG, ≥3 GP) and ranked by PRA:

\`\`\`json
${buildSnapshotPayload(snapshots)}
\`\`\`

Return the Value Meal brief as specified. Flag any players whose value might be affected by injury — the writer will verify before publishing.`,
  });
}
