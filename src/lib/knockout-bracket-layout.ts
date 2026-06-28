import { bracketSlotPickKey } from "@/lib/bracket-slot-picks";
import {
  feederMatchLabel,
  getFeederPair,
  getFeederRoundId,
} from "@/lib/knockout-bracket-feeders";
import { normalizeKnockoutRoundLabel } from "@/lib/knockout-bracket";
import { getKnockoutBasePoints } from "@/lib/scoring";
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
  | { kind: "match"; match: Match; slotIndex: number; columnId: string }
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
    };

export function matchBelongsToColumn(
  match: Pick<Match, "round">,
  column: BracketRoundColumn
): boolean {
  return column.apiRounds.includes(match.round);
}

export function groupKnockoutMatches(matches: Match[]): Map<string, Match[]> {
  const knockout = matches.filter((m) => m.stage === "knockout");

  const grouped = new Map<string, Match[]>();

  for (const column of KNOCKOUT_ROUND_COLUMNS) {
    grouped.set(
      column.id,
      knockout
        .filter((m) => matchBelongsToColumn(m, column))
        .sort((a, b) => a.id - b.id)
    );
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

    for (let i = 0; i < column.expectedSlots; i++) {
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
  feederWinners: (BracketTeamPreview | null)[] | null,
  feederLosers: (BracketTeamPreview | null)[] | null,
  pickMap: Map<number, UserPick>,
  slotPickMap: Map<string, BracketSlotPick>
): {
  slots: BracketMatchSlot[];
  winners: (BracketTeamPreview | null)[];
  losers: (BracketTeamPreview | null)[];
} {
  const slots: BracketMatchSlot[] = [];
  const winners: (BracketTeamPreview | null)[] = [];
  const losers: (BracketTeamPreview | null)[] = [];
  const useLosers = column.id === "third";
  const feeders = useLosers ? feederLosers : feederWinners;

  for (let i = 0; i < column.expectedSlots; i++) {
    const match = roundMatches[i];
    const pair = getFeederPair(column.id, i);

    if (match) {
      const pick = pickMap.get(match.id);
      slots.push({ kind: "match", match, slotIndex: i, columnId: column.id });
      winners.push(winnerFromMatchPick(match, pick));
      losers.push(loserFromMatchPick(match, pick));
    } else {
      const labels = placeholderLabels(column, i);
      const homeTeam = pair ? feeders?.[pair[0]] ?? null : null;
      const awayTeam = pair ? feeders?.[pair[1]] ?? null : null;
      const slotPick = slotPickMap.get(bracketSlotPickKey(column.id, i));
      const pickable =
        column.id !== "ro32" && !!homeTeam && !!awayTeam;

      slots.push({
        kind: "placeholder",
        columnId: column.id,
        roundLabel: column.label,
        slotIndex: i,
        ...labels,
        homeTeam,
        awayTeam,
        pickable,
        slotPick,
      });
      winners.push(
        winnerFromSlotPick(slotPick, homeTeam, awayTeam)
      );
      losers.push(
        loserFromSlotPick(slotPick, homeTeam, awayTeam)
      );
    }
  }

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
  let feederWinners: (BracketTeamPreview | null)[] | null = null;
  let feederLosers: (BracketTeamPreview | null)[] | null = null;

  return KNOCKOUT_ROUND_COLUMNS.map((column) => {
    const roundMatches = grouped.get(column.id) ?? [];
    const { slots, winners, losers } = buildColumnSlots(
      column,
      roundMatches,
      feederWinners,
      feederLosers,
      pickMap,
      slotPickMap
    );
    feederWinners = winners;
    feederLosers = losers;

    const sampleRound = column.apiRounds[0];
    return {
      column,
      slots,
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
