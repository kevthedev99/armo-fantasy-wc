import { isMatchFinished } from "@/lib/scoring";
import type { Match, Pick as UserPick } from "@/lib/types";

type BracketRoundKey = "ro32" | "ro16" | "qf" | "sf" | "third" | "final";

const ROUND_ALIASES: Record<BracketRoundKey, string[]> = {
  ro32: ["Round of 32", "8th Finals"],
  ro16: ["Round of 16"],
  qf: ["Quarter-finals"],
  sf: ["Semi-finals"],
  third: ["3rd Place Final", "Third place"],
  final: ["Final"],
};

export type BracketMatch = Pick<
  Match,
  "id" | "stage" | "round" | "kickoff_at" | "status" | "home_score" | "away_score"
>;

function normalizeRound(round: string): BracketRoundKey | null {
  for (const [key, names] of Object.entries(ROUND_ALIASES) as [
    BracketRoundKey,
    string[],
  ][]) {
    if (names.includes(round)) return key;
  }
  return null;
}

function sortByKickoff(matches: BracketMatch[]): BracketMatch[] {
  return [...matches].sort(
    (a, b) =>
      new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
  );
}

function groupKnockoutRounds(matches: BracketMatch[]): Record<BracketRoundKey, BracketMatch[]> {
  const groups: Record<BracketRoundKey, BracketMatch[]> = {
    ro32: [],
    ro16: [],
    qf: [],
    sf: [],
    third: [],
    final: [],
  };

  for (const match of matches) {
    if (match.stage !== "knockout") continue;
    const key = normalizeRound(match.round);
    if (key) groups[key].push(match);
  }

  for (const key of Object.keys(groups) as BracketRoundKey[]) {
    groups[key] = sortByKickoff(groups[key]);
  }

  return groups;
}

/**
 * Single-elimination feeder map: each match id -> two parent match ids.
 * Ordering within a round follows kickoff time (FIFA bracket slot order).
 */
export function buildBracketParentMap(
  matches: BracketMatch[]
): Map<number, [number, number]> {
  const { ro32, ro16, qf, sf, third, final } = groupKnockoutRounds(matches);
  const parents = new Map<number, [number, number]>();

  function pairParents(
    children: BracketMatch[],
    feeders: BracketMatch[]
  ): void {
    for (let i = 0; i < children.length; i++) {
      const left = feeders[i * 2];
      const right = feeders[i * 2 + 1];
      if (left && right) {
        parents.set(children[i].id, [left.id, right.id]);
      }
    }
  }

  pairParents(ro16, ro32);
  pairParents(qf, ro16);
  pairParents(sf, qf);

  if (final[0] && sf[0] && sf[1]) {
    parents.set(final[0].id, [sf[0].id, sf[1].id]);
  }

  if (third[0] && sf[0] && sf[1]) {
    parents.set(third[0].id, [sf[0].id, sf[1].id]);
  }

  return parents;
}

export function getTransitiveAncestorIds(
  matchId: number,
  parentMap: Map<number, [number, number]>
): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  const stack: number[] = [];

  const direct = parentMap.get(matchId);
  if (direct) stack.push(direct[0], direct[1]);

  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);

    const parents = parentMap.get(id);
    if (parents) stack.push(parents[0], parents[1]);
  }

  return result;
}

export function getDescendantIds(
  matchId: number,
  parentMap: Map<number, [number, number]>
): number[] {
  const childrenByParent = new Map<number, number[]>();

  for (const [childId, [left, right]] of parentMap) {
    for (const parentId of [left, right]) {
      const list = childrenByParent.get(parentId) ?? [];
      list.push(childId);
      childrenByParent.set(parentId, list);
    }
  }

  const seen = new Set<number>();
  const result: number[] = [];
  const stack = [...(childrenByParent.get(matchId) ?? [])];

  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }

  return result;
}

function actualWinner(
  homeScore: number,
  awayScore: number
): "home" | "away" | "draw" {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

function pickMatchesResult(pick: UserPick, match: BracketMatch): boolean {
  if (
    match.home_score === null ||
    match.away_score === null ||
    !isMatchFinished(match.status)
  ) {
    return false;
  }
  return pick.picked_winner === actualWinner(match.home_score, match.away_score);
}

/**
 * NCAA-style chaining: every feeder match on the path must have been picked
 * correctly or this match earns 0 (even if the pick on this match is right).
 */
export function isKnockoutBracketPathAlive(
  match: BracketMatch,
  picksByMatchId: Map<number, UserPick>,
  matchesById: Map<number, BracketMatch>,
  parentMap: Map<number, [number, number]>
): boolean {
  if (match.stage !== "knockout") return true;

  const ancestors = getTransitiveAncestorIds(match.id, parentMap);
  if (ancestors.length === 0) return true;

  for (const ancestorId of ancestors) {
    const ancestorMatch = matchesById.get(ancestorId);
    const ancestorPick = picksByMatchId.get(ancestorId);

    if (!ancestorMatch || !isMatchFinished(ancestorMatch.status)) {
      return false;
    }
    if (!ancestorPick || !pickMatchesResult(ancestorPick, ancestorMatch)) {
      return false;
    }
  }

  return true;
}

export function buildKnockoutScoringContext(matches: BracketMatch[]) {
  const knockoutMatches = matches.filter((m) => m.stage === "knockout");
  const parentMap = buildBracketParentMap(knockoutMatches);
  const matchesById = new Map(knockoutMatches.map((m) => [m.id, m]));
  return { parentMap, matchesById, knockoutMatches };
}
