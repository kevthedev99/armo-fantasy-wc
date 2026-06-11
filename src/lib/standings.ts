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

export function topStandings<T extends Pick<Profile, "total_points" | "total_wins">>(
  profiles: T[],
  limit = 10
): T[] {
  return sortProfiles(profiles).slice(0, limit);
}
