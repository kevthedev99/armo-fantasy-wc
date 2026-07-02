import {
  bracketSlotPickKey,
  buildVirtualMatch,
  displayPickFromSlotPickForSyncedMatch,
  slotPickToDisplayPick,
} from "@/lib/bracket-slot-picks";
import {
  bracketSlotKey,
  buildBracketChainingContext,
  computeAllBracketSlotChaining,
  isSlotPickable,
} from "@/lib/bracket-slot-chaining";
import { getCanonicalSlot } from "@/lib/knockout-bracket-canonical-slots";
import {
  feederMatchLabel,
  getBracketDisplayOrder,
  getFeederPair,
  getFeederRoundId,
} from "@/lib/knockout-bracket-feeders";
import type { BracketSlotChaining } from "@/lib/bracket-slot-chaining";
import { normalizeKnockoutRoundLabel } from "@/lib/knockout-bracket";
import { getKnockoutBasePoints, isMatchLocked } from "@/lib/scoring";
import type { BracketSlotPick, Match, Pick as UserPick } from "@/lib/types";

export type BracketTeamPreview = {
  id: number;
  name: string;
  logo: string | null;
};

export type BracketRoundColumn = {
  id: string;
  label: string;
  apiRounds: string[];
  expectedSlots: number;
};

/** FIFA 2026 knockout tree — 32 total fixtures. */
export const KNOCKOUT_ROUND_COLUMNS: BracketRoundColumn[] = [
  {
    id: "ro32",
    label: "Round of 32",
    apiRounds: ["Round of 32", "8th Finals"],
    expectedSlots: 16,
  },
  {
    id: "r16",
    label: "Round of 16",
    apiRounds: ["Round of 16"],
    expectedSlots: 8,
  },
  {
    id: "qf",
    label: "Quarter-finals",
    apiRounds: ["Quarter-finals"],
    expectedSlots: 4,
  },
  {
    id: "sf",
    label: "Semi-finals",
    apiRounds: ["Semi-finals"],
    expectedSlots: 2,
  },
  {
    id: "final",
    label: "Final",
    apiRounds: ["Final"],
    expectedSlots: 1,
  },
  {
    id: "third",
    label: "Third Place",
    apiRounds: ["3rd Place Final", "Third place"],
    expectedSlots: 1,
  },
];

export const EXPECTED_KNOCKOUT_FIXTURES = KNOCKOUT_ROUND_COLUMNS.reduce(
  (sum, col) => sum + col.expectedSlots,
  0
);

export type BracketMatchSlot =
  | {
      kind: "match";
      match: Match;
      slotIndex: number;
      columnId: string;
      slotPick?: BracketSlotPick;
      chaining?: BracketSlotChaining;
    }
  | {
      kind: "placeholder";
      columnId: string;
      roundLabel: string;
      slotIndex: number;
      homeLabel: string;
      awayLabel: string;
      homeTeam?: BracketTeamPreview | null;
      awayTeam?: BracketTeamPreview | null;
      pickable?: boolean;
      slotPick?: BracketSlotPick;
      chaining?: BracketSlotChaining;
    };

export function matchBelongsToColumn(
  match: Pick<Match, "round">,
  column: BracketRoundColumn
): boolean {
  return column.apiRounds.includes(match.round);
}

/**
 * Returns each column's matches keyed by canonical FIFA slot index. Resolves
 * slots via team-pair lookup (Ro32) or Pacific date + within-day rank (later
 * rounds). Falls back to chronological order for any match whose canonical
 * slot can't be determined (so the bracket still renders for unknown teams).
 *
 * The returned arrays are sparse — `arr[i]` may be undefined for empty slots.
 */
export function groupKnockoutMatches(matches: Match[]): Map<string, Match[]> {
  const knockout = matches.filter((m) => m.stage === "knockout");
  const grouped = new Map<string, Match[]>();

  for (const column of KNOCKOUT_ROUND_COLUMNS) {
    const columnMatches = knockout.filter((m) =>
      matchBelongsToColumn(m, column)
    );
    const slots: Match[] = new Array(column.expectedSlots);
    const unresolved: Match[] = [];

    for (const match of columnMatches) {
      const slot = getCanonicalSlot(
        match,
        column.id,
        columnMatches,
        grouped
      );
      if (
        slot != null &&
        slot >= 0 &&
        slot < column.expectedSlots &&
        !slots[slot]
      ) {
        slots[slot] = match;
      } else {
        unresolved.push(match);
      }
    }

    // Place any unresolved matches into remaining empty slots so the UI still
    // renders. Chronological order keeps the placement stable across renders.
    unresolved.sort((a, b) => {
      const ka = new Date(a.kickoff_at).getTime();
      const kb = new Date(b.kickoff_at).getTime();
      return ka === kb ? a.id - b.id : ka - kb;
    });
    for (const match of unresolved) {
      const empty = slots.findIndex((s) => !s);
      if (empty >= 0) slots[empty] = match;
    }

    grouped.set(column.id, slots);
  }

  return grouped;
}

function placeholderLabels(
  column: BracketRoundColumn,
  slotIndex: number
): { homeLabel: string; awayLabel: string } {
  if (column.id === "ro32") {
    return {
      homeLabel: `TEAM ${slotIndex * 2 + 1}`,
      awayLabel: `TEAM ${slotIndex * 2 + 2}`,
    };
  }

  const feederRoundId = getFeederRoundId(column.id);
  const pair = getFeederPair(column.id, slotIndex);

  if (feederRoundId && pair) {
    const labelFor = (feederSlot: number) => {
      const label = feederMatchLabel(feederRoundId, feederSlot);
      return column.id === "third"
        ? label.replace("Winner", "Runner-up")
        : label;
    };

    return {
      homeLabel: labelFor(pair[0]),
      awayLabel: labelFor(pair[1]),
    };
  }

  const feederRound =
    column.id === "r16"
      ? "Ro32"
      : column.id === "qf"
        ? "R16"
        : column.id === "sf"
          ? "QF"
          : column.id === "final"
            ? "SF"
            : "SF";

  const matchA = slotIndex * 2 + 1;
  const matchB = slotIndex * 2 + 2;

  return {
    homeLabel: `Winner ${feederRound} M${matchA}`,
    awayLabel: `Winner ${feederRound} M${matchB}`,
  };
}

export function buildBracketSlots(matches: Match[]): BracketMatchSlot[] {
  const grouped = groupKnockoutMatches(matches);
  const slots: BracketMatchSlot[] = [];

  for (const column of KNOCKOUT_ROUND_COLUMNS) {
    const roundMatches = grouped.get(column.id) ?? [];
    const displayOrder = getBracketDisplayOrder(column.id, column.expectedSlots);

    for (const i of displayOrder) {
      const match = roundMatches[i];
      if (match) {
        slots.push({ kind: "match", match, slotIndex: i, columnId: column.id });
      } else {
        const labels = placeholderLabels(column, i);
        slots.push({
          kind: "placeholder",
          columnId: column.id,
          roundLabel: column.label,
          slotIndex: i,
          ...labels,
        });
      }
    }
  }

  return slots;
}

function teamPreviewFromMatchSide(
  match: Match,
  side: "home" | "away"
): BracketTeamPreview {
  if (side === "home") {
    return {
      id: match.home_team_id,
      name: match.home_team_name,
      logo: match.home_team_logo,
    };
  }
  return {
    id: match.away_team_id,
    name: match.away_team_name,
    logo: match.away_team_logo,
  };
}

function winnerFromMatchPick(
  match: Match,
  pick: UserPick | undefined
): BracketTeamPreview | null {
  if (!pick) return null;
  if (pick.picked_winner === "home") return teamPreviewFromMatchSide(match, "home");
  if (pick.picked_winner === "away") return teamPreviewFromMatchSide(match, "away");
  return null;
}

function winnerFromSlotPick(
  slotPick: BracketSlotPick | undefined,
  homeTeam: BracketTeamPreview | null,
  awayTeam: BracketTeamPreview | null
): BracketTeamPreview | null {
  if (!slotPick || !homeTeam || !awayTeam) return null;
  if (slotPick.picked_winner === "home") return homeTeam;
  if (slotPick.picked_winner === "away") return awayTeam;
  return null;
}

function loserFromMatchPick(
  match: Match,
  pick: UserPick | undefined
): BracketTeamPreview | null {
  if (!pick) return null;
  if (pick.picked_winner === "home") return teamPreviewFromMatchSide(match, "away");
  if (pick.picked_winner === "away") return teamPreviewFromMatchSide(match, "home");
  return null;
}

function loserFromSlotPick(
  slotPick: BracketSlotPick | undefined,
  homeTeam: BracketTeamPreview | null,
  awayTeam: BracketTeamPreview | null
): BracketTeamPreview | null {
  if (!slotPick || !homeTeam || !awayTeam) return null;
  if (slotPick.picked_winner === "home") return awayTeam;
  if (slotPick.picked_winner === "away") return homeTeam;
  return null;
}

function buildColumnSlots(
  column: BracketRoundColumn,
  roundMatches: Match[],
  feederWinnersByRound: Map<string, (BracketTeamPreview | null)[]>,
  feederLosersByRound: Map<string, (BracketTeamPreview | null)[]>,
  pickMap: Map<number, UserPick>,
  slotPickMap: Map<string, BracketSlotPick>
): {
  slots: BracketMatchSlot[];
  winners: (BracketTeamPreview | null)[];
  losers: (BracketTeamPreview | null)[];
} {
  const slotsByCanonical: BracketMatchSlot[] = new Array(column.expectedSlots);
  const winners: (BracketTeamPreview | null)[] = new Array(column.expectedSlots).fill(null);
  const losers: (BracketTeamPreview | null)[] = new Array(column.expectedSlots).fill(null);
  const feederRoundId = getFeederRoundId(column.id);
  // Third Place pulls from the Semi-final losers, every other round from the
  // feeder round's winners.
  const useLosers = column.id === "third";
  const feeders = feederRoundId
    ? (useLosers ? feederLosersByRound : feederWinnersByRound).get(feederRoundId) ?? null
    : null;

  for (let i = 0; i < column.expectedSlots; i++) {
    const match = roundMatches[i];
    const pair = getFeederPair(column.id, i);

    if (match) {
      const pick = pickMap.get(match.id);
      const slotPick = slotPickMap.get(bracketSlotPickKey(column.id, i));
      slotsByCanonical[i] = {
        kind: "match",
        match,
        slotIndex: i,
        columnId: column.id,
        slotPick,
      };
      winners[i] = winnerFromMatchPick(match, pick);
      losers[i] = loserFromMatchPick(match, pick);
    } else {
      const labels = placeholderLabels(column, i);
      const homeTeam = pair ? feeders?.[pair[0]] ?? null : null;
      const awayTeam = pair ? feeders?.[pair[1]] ?? null : null;
      const slotPick = slotPickMap.get(bracketSlotPickKey(column.id, i));
      const pickable =
        column.id !== "ro32" && !!homeTeam && !!awayTeam;

      slotsByCanonical[i] = {
        kind: "placeholder",
        columnId: column.id,
        roundLabel: column.label,
        slotIndex: i,
        ...labels,
        homeTeam,
        awayTeam,
        pickable,
        slotPick,
      };
      winners[i] = winnerFromSlotPick(slotPick, homeTeam, awayTeam);
      losers[i] = loserFromSlotPick(slotPick, homeTeam, awayTeam);
    }
  }

  // Reorder slots to match the official top-to-bottom bracket layout while
  // keeping winners/losers indexed by canonical slot index for feeder lookups.
  const displayOrder = getBracketDisplayOrder(column.id, column.expectedSlots);
  const slots = displayOrder.map((canonicalIndex) => slotsByCanonical[canonicalIndex]);

  return { slots, winners, losers };
}

export function getBracketColumns(
  matches: Match[],
  picks: UserPick[] = [],
  slotPicks: BracketSlotPick[] = []
): {
  column: BracketRoundColumn;
  slots: BracketMatchSlot[];
  points: number;
}[] {
  const grouped = groupKnockoutMatches(matches);
  const pickMap = new Map(picks.map((pick) => [pick.match_id, pick]));
  const slotPickMap = new Map(
    slotPicks.map((pick) => [
      bracketSlotPickKey(pick.round_id, pick.slot_index),
      pick,
    ])
  );
  const feederWinnersByRound = new Map<string, (BracketTeamPreview | null)[]>();
  const feederLosersByRound = new Map<string, (BracketTeamPreview | null)[]>();
  const chainingCtx = buildBracketChainingContext(matches, picks, slotPicks);
  const chainingBySlot = computeAllBracketSlotChaining(chainingCtx);

  return KNOCKOUT_ROUND_COLUMNS.map((column) => {
    const roundMatches = grouped.get(column.id) ?? [];
    const { slots, winners, losers } = buildColumnSlots(
      column,
      roundMatches,
      feederWinnersByRound,
      feederLosersByRound,
      pickMap,
      slotPickMap
    );
    feederWinnersByRound.set(column.id, winners);
    feederLosersByRound.set(column.id, losers);

    const slotsWithChaining = slots.map((slot) => {
      const chaining = chainingBySlot.get(
        bracketSlotKey(column.id, slot.slotIndex)
      );
      if (!chaining) return slot;

      if (slot.kind === "match") {
        return { ...slot, chaining };
      }

      const pickable =
        !!slot.pickable &&
        isSlotPickable(chaining, false) &&
        !!slot.homeTeam &&
        !!slot.awayTeam;

      return { ...slot, chaining, pickable };
    });

    const sampleRound = column.apiRounds[0];
    return {
      column,
      slots: slotsWithChaining,
      points: getKnockoutBasePoints(sampleRound),
    };
  });
}

export function getKnockoutBracketProgress(
  matches: Pick<Match, "id" | "stage">[],
  picks: Pick<UserPick, "match_id">[],
  slotPicks: Pick<BracketSlotPick, "round_id" | "slot_index">[] = []
): {
  syncedFixtures: number;
  expectedFixtures: number;
  picksMade: number;
  picksOnSynced: number;
  slotPicksMade: number;
  complete: boolean;
} {
  const knockoutIds = new Set(
    matches.filter((m) => m.stage === "knockout").map((m) => m.id)
  );
  const knockoutPicks = picks.filter((p) => knockoutIds.has(p.match_id));

  const syncedFixtures = knockoutIds.size;
  const picksOnSynced = knockoutPicks.length;
  const slotPicksMade = slotPicks.length;

  return {
    syncedFixtures,
    expectedFixtures: EXPECTED_KNOCKOUT_FIXTURES,
    picksMade: picksOnSynced + slotPicksMade,
    picksOnSynced,
    slotPicksMade,
    complete: picksOnSynced >= syncedFixtures && syncedFixtures > 0,
  };
}

export function getRoundLabelForMatch(match: Match): string {
  return normalizeKnockoutRoundLabel(match.round);
}

const KNOCKOUT_ROUND_ORDER = Object.fromEntries(
  KNOCKOUT_ROUND_COLUMNS.map((column, index) => [column.id, index])
);

function teamPreviewFromMatches(
  matches: Match[],
  teamId: number
): BracketTeamPreview {
  for (const match of matches) {
    if (match.home_team_id === teamId) {
      return {
        id: teamId,
        name: match.home_team_name,
        logo: match.home_team_logo,
      };
    }
    if (match.away_team_id === teamId) {
      return {
        id: teamId,
        name: match.away_team_name,
        logo: match.away_team_logo,
      };
    }
  }
  return { id: teamId, name: `Team ${teamId}`, logo: null };
}

export type KnockoutPickEntry = {
  match: Match;
  pick?: UserPick;
  columnId: string;
  slotIndex: number;
};

/** Synced Ro32 picks plus later-round bracket_slot_picks for profile views. */
export function buildKnockoutProfileEntries(
  matches: Match[],
  picks: UserPick[],
  slotPicks: BracketSlotPick[] = []
): KnockoutPickEntry[] {
  const pickMap = new Map(picks.map((pick) => [pick.match_id, pick]));
  const entries: KnockoutPickEntry[] = [];
  const columns = getBracketColumns(matches, picks, slotPicks);

  for (const { column, slots } of columns) {
    for (const slot of slots) {
      if (slot.kind === "match") {
        const pick =
          pickMap.get(slot.match.id) ??
          (slot.slotPick
            ? displayPickFromSlotPickForSyncedMatch(slot.slotPick, slot.match) ??
              undefined
            : undefined);
        if (pick || isMatchLocked(slot.match)) {
          entries.push({
            match: slot.match,
            pick,
            columnId: column.id,
            slotIndex: slot.slotIndex,
          });
        }
        continue;
      }

      if (!slot.slotPick) continue;

      const home =
        slot.homeTeam ??
        teamPreviewFromMatches(matches, slot.slotPick.home_team_id);
      const away =
        slot.awayTeam ??
        teamPreviewFromMatches(matches, slot.slotPick.away_team_id);
      const match = buildVirtualMatch(column, slot.slotIndex, home, away);

      entries.push({
        match,
        pick: slotPickToDisplayPick(slot.slotPick, match),
        columnId: column.id,
        slotIndex: slot.slotIndex,
      });
    }
  }

  return entries.sort((a, b) => {
    const roundDiff =
      (KNOCKOUT_ROUND_ORDER[a.columnId] ?? 99) -
      (KNOCKOUT_ROUND_ORDER[b.columnId] ?? 99);
    if (roundDiff !== 0) return roundDiff;
    return a.slotIndex - b.slotIndex;
  });
}
