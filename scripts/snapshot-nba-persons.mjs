#!/usr/bin/env node
/**
 * Snapshot the NBA Stats person-id map to lib/data/nba-person-ids.json.
 *
 * Run this locally (where stats.nba.com is reachable) to refresh the seed
 * file the server uses as a fallback when the live fetch fails from Vercel.
 *
 *   node scripts/snapshot-nba-persons.mjs [season]
 *
 * `season` defaults to 2025 (the 2025-26 NBA season). Pass a different year
 * on the command line to snapshot a different season.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const OUT_PATH = join(REPO_ROOT, "lib/data/nba-person-ids.json");

const season = parseInt(process.argv[2] ?? "2025", 10);
const seasonStr = `${season}-${String(season + 1).slice(-2)}`;
const url = `https://stats.nba.com/stats/commonallplayers?LeagueID=00&Season=${seasonStr}&IsOnlyCurrentSeason=1`;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.nba.com/",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.nba.com",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

function normalizePlayerName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

console.log(`Fetching ${seasonStr} roster from stats.nba.com…`);
const res = await fetch(url, { headers: HEADERS });
if (!res.ok) {
  console.error(`stats.nba.com returned ${res.status} ${res.statusText}`);
  process.exit(1);
}
const json = await res.json();
const rs = json.resultSets?.[0];
if (!rs?.headers || !Array.isArray(rs.rowSet)) {
  console.error("Unexpected response shape from stats.nba.com");
  process.exit(1);
}

const personIdx = rs.headers.indexOf("PERSON_ID");
const nameIdx = rs.headers.indexOf("DISPLAY_FIRST_LAST");
if (personIdx === -1 || nameIdx === -1) {
  console.error("Expected columns (PERSON_ID, DISPLAY_FIRST_LAST) missing");
  process.exit(1);
}

const map = {};
for (const row of rs.rowSet) {
  const id = row[personIdx];
  const name = row[nameIdx];
  if (typeof id === "number" && typeof name === "string") {
    map[normalizePlayerName(name)] = id;
  }
}

const sorted = Object.fromEntries(
  Object.entries(map).sort(([a], [b]) => a.localeCompare(b)),
);

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(sorted, null, 2) + "\n");
console.log(`Wrote ${Object.keys(sorted).length} entries to ${OUT_PATH}`);
