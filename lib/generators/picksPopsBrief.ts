import type { PlayerSnapshot } from "../balldontlie";
import type { BriefContent } from "../firestore";
import {
  generateBrief,
  buildSnapshotPayload,
  jsonSchemaInstruction,
} from "./shared";

const SYSTEM_PROMPT = `You are the data engine for The UnOfficial's Picks, Pops & Rolls column.

Pull the upcoming weekend slate (Friday through Sunday games) and generate candidates for each of the three formats:

PICK — find the strongest value play for this weekend:
- A player prop or performance angle supported by matchup data, recent form, and usage trends
- Prioritize situations where the data strongly supports a narrative (hot streak into weak defense, etc.)
- Pull: opponent defensive ratings, recent player usage %, home/away splits, rest days

POP — find the most interesting underdog or overlooked story for the weekend:
- A player whose role or opportunity has quietly expanded
- A team matchup where the underdog has a legitimate structural advantage
- Pull: pace mismatches, defensive scheme vulnerabilities, injury-depleted rosters on the other side

ROLL — find the most likely disappointment:
- An overexposed player due for regression, a team on a brutal schedule stretch, a narrative bet that the data doesn't support
- Pull: back-to-back situations, usage spikes that historically precede dips, schedule difficulty

Flag any injury or lineup situations the writer should verify before publishing — note where the data assumes a player is active but their status may be uncertain.

${jsonSchemaInstruction()}`;

export async function generatePicksPopsBrief(
  snapshots: PlayerSnapshot[],
): Promise<BriefContent> {
  const today = new Date().toISOString().split("T")[0];

  return generateBrief({
    systemPrompt: SYSTEM_PROMPT,
    snapshots,
    userMessage: `Today is ${today} (First Friday of the month — Picks, Pops & Rolls day).

Here is the last 7 days of NBA player data, already filtered to qualifying rotation players (≥15 MPG, ≥3 GP) and ranked by PRA:

\`\`\`json
${buildSnapshotPayload(snapshots)}
\`\`\`

Return the Picks, Pops & Rolls brief as specified. Focus on the tactical WHY behind the numbers, not just the numbers themselves. Flag any coaching or scheme changes the writer should verify.`,
  });
}
