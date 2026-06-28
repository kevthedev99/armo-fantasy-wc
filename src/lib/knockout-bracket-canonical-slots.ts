/**
 * Map an API-Football fixture to its canonical FIFA 2026 bracket slot.
 *
 * API-Football fixture IDs are roughly chronological, but FIFA's match numbers
 * (M73–M104) are NOT chronological within a single day — e.g. on Mon Jun 29
 * the earliest kickoff is Houston (M76) at 1pm ET but FIFA labels it 76, not 74.
 *
 * For Round of 32 (teams are known), we identify each match by its team pair.
 * For later rounds (teams are TBD), we identify by Pacific calendar date plus
 * chronological rank within that day, since the FIFA schedule is published.
 */

import type { Match } from "@/lib/types";

function normalizeTeam(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

const TEAM_ALIASES: Record<string, string> = {
  unitedstates: "usa",
  unitedstatesofamerica: "usa",
  cotedivoire: "ivorycoast",
  caboverde: "capeverde",
  cabo: "capeverde",
  congodr: "drcongo",
  drcongo: "drcongo",
  democraticrepublicofthecongo: "drcongo",
  democraticrepublicofcongo: "drcongo",
  bosnia: "bosniaandherzegovina",
  bosniaherzegovina: "bosniaandherzegovina",
  korearepublic: "southkorea",
  republicofkorea: "southkorea",
};

function canonicalTeamKey(name: string): string {
  const norm = normalizeTeam(name);
  return TEAM_ALIASES[norm] ?? norm;
}

function teamPairKey(a: string, b: string): string {
  return [canonicalTeamKey(a), canonicalTeamKey(b)].sort().join("|");
}

/** Round of 32 canonical match → FIFA slot (= match number − 73). */
const RO32_SLOT_BY_TEAM_PAIR = new Map<string, number>(
  (
    [
      ["South Africa", "Canada", 0], // M73
      ["Germany", "Paraguay", 1], // M74
      ["Netherlands", "Morocco", 2], // M75
      ["Brazil", "Japan", 3], // M76
      ["France", "Sweden", 4], // M77
      ["Ivory Coast", "Norway", 5], // M78
      ["Mexico", "Ecuador", 6], // M79
      ["England", "DR Congo", 7], // M80
      ["USA", "Bosnia and Herzegovina", 8], // M81
      ["Belgium", "Senegal", 9], // M82
      ["Portugal", "Croatia", 10], // M83
      ["Spain", "Austria", 11], // M84
      ["Switzerland", "Algeria", 12], // M85
      ["Argentina", "Cape Verde", 13], // M86
      ["Colombia", "Ghana", 14], // M87
      ["Australia", "Egypt", 15], // M88
    ] as [string, string, number][]
  ).map(([h, a, s]) => [teamPairKey(h, a), s])
);

const PACIFIC_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function pacificDate(iso: string): string {
  return PACIFIC_DATE_FORMATTER.format(new Date(iso));
}

/**
 * Per-day canonical slot assignment for rounds with TBD teams.
 * Key: Pacific date (YYYY-MM-DD). Value: canonical slot indices in chronological
 * (earliest-kickoff-first) order for that day.
 */
const DAY_SLOT_MAP: Record<string, Record<string, number[]>> = {
  r16: {
    // Sat Jul 4: Houston M90 1pm ET, Philadelphia M89 5pm ET
    "2026-07-04": [1, 0],
    // Sun Jul 5: NY/NJ M91 4pm ET, Mexico City M92 8pm ET
    "2026-07-05": [2, 3],
    // Mon Jul 6: Dallas M93 3pm ET, Seattle M94 8pm ET
    "2026-07-06": [4, 5],
    // Tue Jul 7: Atlanta M95 12pm ET, Vancouver M96 4pm ET
    "2026-07-07": [6, 7],
  },
  qf: {
    "2026-07-09": [0], // M97 Boston
    "2026-07-10": [1], // M98 LA
    // Sat Jul 11: Miami M99 earlier, Kansas City M100 later
    "2026-07-11": [2, 3],
  },
  sf: {
    "2026-07-14": [0], // M101 Dallas
    "2026-07-15": [1], // M102 Atlanta
  },
  third: {
    "2026-07-18": [0], // M103
  },
  final: {
    "2026-07-19": [0], // M104
  },
};

/** Return the canonical FIFA slot index for this match, or null if unknown. */
export function getCanonicalSlot(
  match: Pick<
    Match,
    "stage" | "round" | "home_team_name" | "away_team_name" | "kickoff_at"
  >,
  columnId: string,
  allColumnMatches: Pick<Match, "kickoff_at">[]
): number | null {
  if (columnId === "ro32") {
    const key = teamPairKey(match.home_team_name, match.away_team_name);
    const slot = RO32_SLOT_BY_TEAM_PAIR.get(key);
    return slot ?? null;
  }

  const daySlots = DAY_SLOT_MAP[columnId];
  if (!daySlots) return null;

  const date = pacificDate(match.kickoff_at);
  const slots = daySlots[date];
  if (!slots) return null;

  // Find this match's chronological rank among same-day same-round matches.
  const sameDayMatches = allColumnMatches
    .filter((m) => pacificDate(m.kickoff_at) === date)
    .map((m) => new Date(m.kickoff_at).getTime())
    .sort((a, b) => a - b);

  const matchTime = new Date(match.kickoff_at).getTime();
  const rank = sameDayMatches.indexOf(matchTime);
  if (rank < 0 || rank >= slots.length) return null;

  return slots[rank];
}
