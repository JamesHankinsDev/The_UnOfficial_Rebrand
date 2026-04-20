/**
 * Cross-feed name aliases for NBA Stats ↔ BallDontLie.
 *
 * BallDontLie exposes only a single `first_name` + `last_name` per player,
 * so when the two feeds disagree on what a player "goes by" (e.g. BallDontLie
 * returns "Ace Bailey" while NBA Stats lists him as "Airious Bailey"),
 * name-based lookups miss and the card loses its headshot.
 *
 * Tuple convention: [preferred, alternate]. The first entry is the name we
 * *display* on the card; the second is the alternate variant we want to
 * collapse into it. Either variant will resolve to the same nbaId.
 */
export const NBA_NAME_ALIASES: readonly [string, string][] = [
  ["Ace Bailey", "Airious Bailey"],
  ["Bub Carrington", "Carlton Carrington"],
];
