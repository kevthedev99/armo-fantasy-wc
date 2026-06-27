import { normalizeKnockoutRoundLabel } from "@/lib/knockout-bracket";
import { getKnockoutBasePoints } from "@/lib/scoring";
import type { Match, Pick as UserPick } from "@/lib/types";

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
  | { kind: "match"; match: Match; slotIndex: number }
  | {
      kind: "placeholder";
      roundLabel: string;
      slotIndex: number;
      homeLabel: string;
      awayLabel: string;
    };

export function matchBelongsToColumn(
  match: Pick<Match, "round">,
  column: BracketRoundColumn
): boolean {
  return column.apiRounds.includes(match.round);
}

export function groupKnockoutMatches(matches: Match[]): Map<string, Match[]> {
  const knockout = matches
    .filter((m) => m.stage === "knockout")
    .sort(
      (a, b) =>
        new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
    );

  const grouped = new Map<string, Match[]>();

  for (const column of KNOCKOUT_ROUND_COLUMNS) {
    grouped.set(
      column.id,
      knockout.filter((m) => matchBelongsToColumn(m, column))
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
        slots.push({ kind: "match", match, slotIndex: i });
      } else {
        const labels = placeholderLabels(column, i);
        slots.push({
          kind: "placeholder",
          roundLabel: column.label,
          slotIndex: i,
          ...labels,
        });
      }
    }
  }

  return slots;
}

export function getBracketColumns(matches: Match[]): {
  column: BracketRoundColumn;
  slots: BracketMatchSlot[];
  points: number;
}[] {
  const grouped = groupKnockoutMatches(matches);

  return KNOCKOUT_ROUND_COLUMNS.map((column) => {
    const roundMatches = grouped.get(column.id) ?? [];
    const slots: BracketMatchSlot[] = [];

    for (let i = 0; i < column.expectedSlots; i++) {
      const match = roundMatches[i];
      if (match) {
        slots.push({ kind: "match", match, slotIndex: i });
      } else {
        const labels = placeholderLabels(column, i);
        slots.push({
          kind: "placeholder",
          roundLabel: column.label,
          slotIndex: i,
          ...labels,
        });
      }
    }

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
  picks: Pick<UserPick, "match_id">[]
): {
  syncedFixtures: number;
  expectedFixtures: number;
  picksMade: number;
  picksOnSynced: number;
  complete: boolean;
} {
  const knockoutIds = new Set(
    matches.filter((m) => m.stage === "knockout").map((m) => m.id)
  );
  const knockoutPicks = picks.filter((p) => knockoutIds.has(p.match_id));

  const syncedFixtures = knockoutIds.size;
  const picksOnSynced = knockoutPicks.length;

  return {
    syncedFixtures,
    expectedFixtures: EXPECTED_KNOCKOUT_FIXTURES,
    picksMade: knockoutPicks.length,
    picksOnSynced,
    complete: picksOnSynced >= syncedFixtures && syncedFixtures > 0,
  };
}

export function getRoundLabelForMatch(match: Match): string {
  return normalizeKnockoutRoundLabel(match.round);
}
