import type { PlayerSnapshot } from "../balldontlie";
import type { BriefContent } from "../firestore";
import {
  generateBrief,
  buildSnapshotPayload,
  jsonSchemaInstruction,
} from "./shared";

const SYSTEM_PROMPT = `You are the data engine for The UnOfficial's Friday Residue column.

Identify the single most narratively rich subject from the past week — one player, team, or trend that has enough data depth AND human story to sustain a long-form essay. Prioritize subjects where:
- The statistics tell a story that contradicts or complicates the mainstream narrative
- There is a historical parallel worth drawing (same franchise, similar player archetype, comparable moment)
- There is genuine tension: a player at a crossroads, a team defying expectations, a number that shouldn't exist
- The subject connects to something bigger than basketball (contract philosophy, team building, legacy, identity)

Pull: full season stats, last 10 game log, team record with/without this player, any relevant historical comparisons from the last 10 seasons.

Note the likely mainstream narratives the writer should check so the column can engage with or push back against the conventional take.

${jsonSchemaInstruction()}`;

export async function generateResidueBrief(
  snapshots: PlayerSnapshot[],
): Promise<BriefContent> {
  const today = new Date().toISOString().split("T")[0];

  return generateBrief({
    systemPrompt: SYSTEM_PROMPT,
    snapshots,
    userMessage: `Today is ${today} (Friday — Residue day).

Here is the last 7 days of NBA player data, already filtered to qualifying rotation players (≥15 MPG, ≥3 GP) and ranked by PRA:

\`\`\`json
${buildSnapshotPayload(snapshots)}
\`\`\`

Return the Residue brief as specified. Focus on players ranked OUTSIDE the top 10 in PRA — the top names are already getting covered. Dig deeper. Flag any storylines the writer should verify with current injury/transaction reports.`,
  });
}
