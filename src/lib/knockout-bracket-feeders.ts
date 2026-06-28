/**
 * FIFA World Cup 2026 official knockout feeder paths.
 * Ro32 = matches 73–88 (slots 0–15), R16 = 89–96, QF = 97–100, SF = 101–102.
 * @see https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/knockout-stage-match-schedule-bracket
 */

export const ROUND_FIRST_MATCH_NUMBER: Record<string, number> = {
  ro32: 73,
  r16: 89,
  qf: 97,
  sf: 101,
  third: 103,
  final: 104,
};

/** [homeFeederSlot, awayFeederSlot] in the previous round column. */
export const KNOCKOUT_FEEDER_PAIRS: Record<string, [number, number][]> = {
  r16: [
    [1, 4], // M89: W74 vs W77
    [0, 2], // M90: W73 vs W75 (SA/Canada path)
    [3, 5], // M91: W76 vs W78
    [6, 7], // M92: W79 vs W80
    [10, 11], // M93: W83 vs W84
    [8, 9], // M94: W81 vs W82
    [13, 15], // M95: W86 vs W88
    [12, 14], // M96: W85 vs W87
  ],
  qf: [
    [0, 1], // M97: W89 vs W90
    [4, 5], // M98: W93 vs W94
    [2, 3], // M99: W91 vs W92
    [6, 7], // M100: W95 vs W96
  ],
  sf: [
    [0, 1], // M101: W97 vs W98
    [2, 3], // M102: W99 vs W100
  ],
  final: [
    [0, 1], // M104: W101 vs W102
  ],
  third: [
    [0, 1], // M103: loser M101 vs loser M102
  ],
};

const FEEDER_ROUND: Record<string, string> = {
  r16: "ro32",
  qf: "r16",
  sf: "qf",
  final: "sf",
  third: "sf",
};

export function getFeederRoundId(columnId: string): string | null {
  return FEEDER_ROUND[columnId] ?? null;
}

export function getFeederPair(
  columnId: string,
  slotIndex: number
): [number, number] | null {
  return KNOCKOUT_FEEDER_PAIRS[columnId]?.[slotIndex] ?? null;
}

export function matchNumberForSlot(columnId: string, slotIndex: number): number {
  const base = ROUND_FIRST_MATCH_NUMBER[columnId];
  return base != null ? base + slotIndex : slotIndex + 1;
}

export function feederMatchLabel(
  feederColumnId: string,
  feederSlotIndex: number
): string {
  const roundLabel =
    feederColumnId === "ro32"
      ? "Ro32"
      : feederColumnId === "r16"
        ? "R16"
        : feederColumnId === "qf"
          ? "QF"
          : feederColumnId === "sf"
            ? "SF"
            : feederColumnId.toUpperCase();

  return `Winner ${roundLabel} M${matchNumberForSlot(feederColumnId, feederSlotIndex)}`;
}

/** All Ro32 slot indices that determine teams for a later-round slot. */
export function collectRo32FeederSlotIndices(
  roundId: string,
  slotIndex: number
): number[] {
  if (roundId === "ro32") return [slotIndex];

  const pair = getFeederPair(roundId, slotIndex);
  if (!pair) return [];

  const feederRound = getFeederRoundId(roundId);
  if (!feederRound) return [];

  if (feederRound === "ro32") {
    return [...pair];
  }

  const indices = new Set<number>();
  for (const feederSlot of pair) {
    for (const ro32Slot of collectRo32FeederSlotIndices(feederRound, feederSlot)) {
      indices.add(ro32Slot);
    }
  }
  return [...indices].sort((a, b) => a - b);
}
