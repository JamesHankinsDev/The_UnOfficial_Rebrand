import { randomInt } from "crypto";

/**
 * 32-char alphabet minus visually ambiguous glyphs (0/O, 1/I/L). Gives
 * ~1B permutations at length 8 — collisions are rare enough that a single
 * retry pass inside the create route is more than sufficient.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LEAGUE_CODE_LENGTH = 8;

/** Generate a random invite code formatted as XXXX-XXXX. */
export function generateInviteCode(): string {
  let raw = "";
  for (let i = 0; i < LEAGUE_CODE_LENGTH; i++) {
    raw += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** Strip formatting and upper-case a user-supplied code for lookup. */
export function normalizeInviteCode(input: string): string {
  const stripped = input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (stripped.length !== LEAGUE_CODE_LENGTH) return stripped;
  return `${stripped.slice(0, 4)}-${stripped.slice(4)}`;
}
