/**
 * Positional slot rules for TCG lineups.
 *
 * The starting five is 2 Guards, 2 Forwards, 1 Center. A slot is identified
 * by its index — `LINEUP_SLOT_POSITIONS[i]` says which bucket slot `i` must
 * be filled from.
 */

export type SlotPosition = "G" | "F" | "C";

export const LINEUP_SLOT_POSITIONS: readonly SlotPosition[] = [
  "G",
  "G",
  "F",
  "F",
  "C",
] as const;

export const SLOT_POSITION_LABELS: Record<SlotPosition, string> = {
  G: "Guard",
  F: "Forward",
  C: "Center",
};

/**
 * Maps BallDontLie's free-form position strings ("G", "F-C", "G-F", "PG" …)
 * onto the set of lineup buckets a player is eligible for. Hybrids like "G-F"
 * are allowed to fill either slot.
 *
 * An unknown / missing position falls back to every bucket — better to let a
 * rare unclassified player be rostered than strand them entirely.
 */
export function eligibleSlotPositions(
  pos: string | null | undefined,
): Set<SlotPosition> {
  const raw = (pos ?? "").toUpperCase().trim();
  const set = new Set<SlotPosition>();
  if (raw.includes("G")) set.add("G");
  if (raw.includes("F")) set.add("F");
  if (raw.includes("C")) set.add("C");
  if (set.size === 0) {
    set.add("G");
    set.add("F");
    set.add("C");
  }
  return set;
}

/** True if a player with the given position can slot into this lineup index. */
export function canFillSlot(
  pos: string | null | undefined,
  slotIndex: number,
): boolean {
  const required = LINEUP_SLOT_POSITIONS[slotIndex];
  if (!required) return false;
  return eligibleSlotPositions(pos).has(required);
}
