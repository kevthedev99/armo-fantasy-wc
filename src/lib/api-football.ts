import type { ApiFootballFixture, GroupBracket, GroupStandingTeam } from "./types";

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

export function parseGroupName(round: string): string | null {
  const match = round.match(/Group\s+([A-L])/i);
  return match ? `GROUP ${match[1].toUpperCase()}` : null;
}

export function parseStage(round: string): "group" | "knockout" {
  return round.toLowerCase().includes("group") ? "group" : "knockout";
}

type ApiStandingRow = {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  group: string;
  form: string | null;
  description: string | null;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
};

function mapStandingRow(row: ApiStandingRow): GroupStandingTeam {
  return {
    rank: row.rank,
    teamId: row.team.id,
    name: row.team.name,
    logo: row.team.logo,
    played: row.all.played,
    win: row.all.win,
    draw: row.all.draw,
    lose: row.all.lose,
    goalsFor: row.all.goals.for,
    goalsAgainst: row.all.goals.against,
    goalsDiff: row.goalsDiff,
    points: row.points,
    form: row.form,
  };
}

/** Group-stage tables for World Cup (12 groups of 4). */
export async function fetchWorldCupStandings(): Promise<GroupBracket[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");

  const url = new URL(`${BASE_URL}/standings`);
  url.searchParams.set("league", String(WORLD_CUP.leagueId));
  url.searchParams.set("season", String(WORLD_CUP.season));

  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": key },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`API-Football standings error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const groups = (json.response?.[0]?.league?.standings ?? []) as ApiStandingRow[][];

  return groups
    .filter((group) => /Group Stage - Group [A-L]/i.test(group[0]?.group ?? ""))
    .map((group) => {
      const letter =
        group[0].group.match(/Group ([A-L])$/i)?.[1]?.toUpperCase() ?? "?";
      return {
        name: `GROUP ${letter}`,
        teams: group.map(mapStandingRow),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
