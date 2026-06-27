import type { ApiFootballFixture, GroupBracket, GroupStandingTeam } from "./types";
import type { ApiFootballEvent } from "./match-events";

const BASE_URL = "https://v3.football.api-sports.io";

export const WORLD_CUP = {
  leagueId: 1,
  season: 2026,
} as const;

const FIXTURE_HEADERS = (key: string) => ({ "x-apisports-key": key });

async function fetchFixturesFromApi(
  key: string,
  params: Record<string, string>,
  /** Per-fixture refresh must not send league/season — API returns empty. */
  options?: { includeLeagueFilter?: boolean }
): Promise<ApiFootballFixture[]> {
  const url = new URL(`${BASE_URL}/fixtures`);
  if (options?.includeLeagueFilter !== false) {
    url.searchParams.set("league", String(WORLD_CUP.leagueId));
    url.searchParams.set("season", String(WORLD_CUP.season));
  }
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }

  const res = await fetch(url.toString(), {
    headers: FIXTURE_HEADERS(key),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API-Football error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  return json.response ?? [];
}

function formatCalendarDate(iso: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(iso);
}

/** YYYY-MM-DD in Pacific and UTC — API date filter can miss fixtures near midnight. */
export function getLightSyncDates(
  now = new Date(),
  /** When no live games, skip tomorrow to save API calls per tick. */
  compact = false
): string[] {
  const msPerDay = 24 * 60 * 60 * 1000;
  const dates = new Set<string>();

  for (const offset of compact ? [-1, 0] : [-1, 0, 1]) {
    const day = new Date(now.getTime() + offset * msPerDay);
    dates.add(formatCalendarDate(day, "America/Los_Angeles"));
    dates.add(formatCalendarDate(day, "UTC"));
  }

  return [...dates];
}

const FINISHED_FIXTURE_STATUSES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);
const IN_PROGRESS_FIXTURE_STATUSES = new Set([
  "1H",
  "HT",
  "2H",
  "ET",
  "BT",
  "P",
  "LIVE",
  "INT",
  "SUSP",
]);

function fixtureFreshness(fixture: ApiFootballFixture): number {
  const status = fixture.fixture.status.short;
  if (FINISHED_FIXTURE_STATUSES.has(status)) return 2;
  if (IN_PROGRESS_FIXTURE_STATUSES.has(status)) return 1;
  return 0;
}

function fixtureElapsed(fixture: ApiFootballFixture): number {
  const status = fixture.fixture.status as { elapsed?: number | null };
  return status.elapsed ?? 0;
}

function shouldReplaceFixture(
  existing: ApiFootballFixture,
  incoming: ApiFootballFixture
): boolean {
  const nextScore = fixtureFreshness(incoming);
  const prevScore = fixtureFreshness(existing);
  if (nextScore !== prevScore) return nextScore > prevScore;
  return fixtureElapsed(incoming) >= fixtureElapsed(existing);
}

/** Later entries win when fresher; finished status beats stale in-progress from bulk lists. */
export function mergeFixturesById(
  fixtures: ApiFootballFixture[]
): ApiFootballFixture[] {
  const byId = new Map<number, ApiFootballFixture>();

  for (const fixture of fixtures) {
    const id = fixture.fixture.id;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, fixture);
      continue;
    }

    if (shouldReplaceFixture(existing, fixture)) {
      byId.set(id, fixture);
    }
  }

  return [...byId.values()];
}

export async function fetchWorldCupFixtures(): Promise<ApiFootballFixture[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");
  return fetchFixturesFromApi(key, {});
}

export async function fetchLiveWorldCupFixtures(): Promise<ApiFootballFixture[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");
  return fetchFixturesFromApi(key, { live: "all" });
}

export async function fetchWorldCupFixturesByDate(
  date: string
): Promise<ApiFootballFixture[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");
  return fetchFixturesFromApi(key, { date });
}

export async function fetchWorldCupFixturesByIds(
  fixtureIds: number[]
): Promise<ApiFootballFixture[]> {
  if (fixtureIds.length === 0) return [];

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");

  const batches = await Promise.all(
    fixtureIds.map((id) =>
      fetchFixturesFromApi(key, { id: String(id) }, { includeLeagueFilter: false })
    )
  );

  return mergeFixturesById(batches.flat());
}

/** Full season list, or live + nearby dates for frequent cron ticks. */
export async function fetchFixturesForSync(
  mode: "full" | "light",
  refreshFixtureIds: number[] = []
): Promise<ApiFootballFixture[]> {
  const refreshed = await fetchWorldCupFixturesByIds(refreshFixtureIds);

  if (mode === "full") {
    const all = await fetchWorldCupFixtures();
    return mergeFixturesById([...all, ...refreshed]);
  }

  const live = await fetchLiveWorldCupFixtures();
  const dates = getLightSyncDates(undefined, live.length === 0);
  const byDate = await Promise.all(
    dates.map((date) => fetchWorldCupFixturesByDate(date))
  );

  // Bulk date lists first, then live feed, then per-id refresh (most authoritative).
  return mergeFixturesById([...byDate.flat(), ...live, ...refreshed]);
}

export async function fetchFixtureEvents(
  fixtureId: number
): Promise<ApiFootballEvent[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");

  const url = new URL(`${BASE_URL}/fixtures/events`);
  url.searchParams.set("fixture", String(fixtureId));

  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API-Football events error: ${res.status} ${res.statusText}`);
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

export type ParsedMatchScores = {
  homeScore: number | null;
  awayScore: number | null;
  penHomeScore: number | null;
  penAwayScore: number | null;
};

/** Regulation/extra-time score plus optional penalty shootout counts. */
export function parseMatchScoresFromFixture(
  f: ApiFootballFixture
): ParsedMatchScores {
  const status = f.fixture.status.short;
  const penHome = f.score.penalty?.home ?? null;
  const penAway = f.score.penalty?.away ?? null;

  if (status === "PEN" && penHome !== null && penAway !== null) {
    return {
      homeScore:
        f.score.extratime?.home ??
        f.score.fulltime?.home ??
        f.goals.home,
      awayScore:
        f.score.extratime?.away ??
        f.score.fulltime?.away ??
        f.goals.away,
      penHomeScore: penHome,
      penAwayScore: penAway,
    };
  }

  return {
    homeScore: f.goals.home ?? f.score.fulltime.home,
    awayScore: f.goals.away ?? f.score.fulltime.away,
    penHomeScore: null,
    penAwayScore: null,
  };
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

function parseStandingGroupLabel(groupLabel: string): string | null {
  const match = groupLabel.match(/Group\s+([A-L])$/i);
  return match ? `GROUP ${match[1].toUpperCase()}` : null;
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
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API-Football standings error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const groups = (json.response?.[0]?.league?.standings ?? []) as ApiStandingRow[][];

  return groups
    .filter((group) => {
      const label = group[0]?.group ?? "";
      return group.length === 4 && parseStandingGroupLabel(label) !== null;
    })
    .map((group) => ({
      name: parseStandingGroupLabel(group[0].group)!,
      teams: group.map(mapStandingRow),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
