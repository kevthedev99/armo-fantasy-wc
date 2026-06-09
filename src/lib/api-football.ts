import type { ApiFootballFixture } from "./types";

const BASE_URL = "https://v3.football.api-sports.io";

export const WORLD_CUP = {
  leagueId: 1,
  season: 2026,
} as const;

export async function fetchWorldCupFixtures(): Promise<ApiFootballFixture[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");

  const url = new URL(`${BASE_URL}/fixtures`);
  url.searchParams.set("league", String(WORLD_CUP.leagueId));
  url.searchParams.set("season", String(WORLD_CUP.season));

  const res = await fetch(url.toString(), {
    headers: {
      "x-apisports-key": key,
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`API-Football error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  return json.response ?? [];
}

export async function fetchFixtureEvents(fixtureId: number) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");

  const url = new URL(`${BASE_URL}/fixtures/events`);
  url.searchParams.set("fixture", String(fixtureId));

  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": key },
    next: { revalidate: 0 },
  });

  if (!res.ok) return [];

  const json = await res.json();
  return json.response ?? [];
}

export function parseGroupName(round: string): string | null {
  const match = round.match(/Group\s+([A-L])/i);
  return match ? `GROUP ${match[1].toUpperCase()}` : null;
}

export function parseStage(round: string): "group" | "knockout" {
  return round.toLowerCase().includes("group") ? "group" : "knockout";
}

export function findWinningGoalMinute(
  events: Array<{
    type: string;
    detail: string;
    team: { id: number };
    time: { elapsed: number; extra: number | null };
  }>,
  winnerTeamId: number
): number | null {
  const goals = events.filter(
    (e) =>
      e.type === "Goal" &&
      e.detail !== "Missed Penalty" &&
      e.team.id === winnerTeamId
  );

  if (goals.length === 0) return null;

  const last = goals[goals.length - 1];
  return last.time.elapsed + (last.time.extra ?? 0);
}
