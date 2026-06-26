import type { Profile } from "./types";

/** Same tie-break as the standings table: points, then wins. */
export function sortProfiles<T extends Pick<Profile, "total_points" | "total_wins">>(
  profiles: T[]
): T[] {
  return [...profiles].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    return b.total_wins - a.total_wins;
  });
}

/** 1-based rank for each profile id. */
export function buildRankById<T extends { id: string; total_points: number; total_wins: number }>(
  profiles: T[]
): Map<string, number> {
  return new Map(
    sortProfiles(profiles).map((profile, index) => [profile.id, index + 1])
  );
}

/** Positive = moved up, negative = moved down, zero = no change. */
export function rankDelta(oldRank: number, newRank: number): number {
  return oldRank - newRank;
}

export function computeRankChanges<
  T extends { id: string; total_points: number; total_wins: number },
>(before: T[], after: T[]): Map<string, number> {
  const oldRanks = buildRankById(before);
  const newRanks = buildRankById(after);
  const changes = new Map<string, number>();

  for (const profile of after) {
    const previous = oldRanks.get(profile.id);
    const current = newRanks.get(profile.id);
    if (previous === undefined || current === undefined) continue;
    changes.set(profile.id, rankDelta(previous, current));
  }

  return changes;
}

export function topStandings<T extends Pick<Profile, "total_points" | "total_wins">>(
  profiles: T[],
  limit = 10
): T[] {
  return sortProfiles(profiles).slice(0, limit);
}

/** Profile ids tied for the most correct-winner picks (empty if everyone has 0). */
export function getMostWinsLeaderIds(
  profiles: Pick<Profile, "id" | "total_wins">[]
): Set<string> {
  if (profiles.length === 0) return new Set();

  const maxWins = Math.max(...profiles.map((p) => p.total_wins));
  if (maxWins <= 0) return new Set();

  return new Set(
    profiles.filter((p) => p.total_wins === maxWins).map((p) => p.id)
  );
}
