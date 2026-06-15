import { NextResponse } from "next/server";
import {
  fetchFixtureEvents,
  fetchWorldCupFixtures,
  parseGroupName,
  parseStage,
} from "@/lib/api-football";
import { isDiscordConfigured, postDiscordLeaderboard } from "@/lib/discord";
import {
  findNewEvents,
  parseFixtureEvents,
  shouldBootstrapEvents,
  shouldFetchEvents,
} from "@/lib/match-events";
import {
  notifyFullTime,
  notifyMatchEvents,
  shouldNotifyFullTime,
} from "@/lib/match-notifications";
import {
  aggregateProfileStats,
  computeCurrentStreak,
  isMatchFinished,
  scorePick,
} from "@/lib/scoring";
import type { MatchEvent, Pick } from "@/lib/types";
import { topStandings } from "@/lib/standings";
import { createServiceClient } from "@/lib/supabase/server";

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Supabase/PostgREST caps responses at 1000 rows — paginate to avoid missing picks. */
async function fetchAllPicks(
  supabase: ReturnType<typeof createServiceClient>
): Promise<Pick[]> {
  const pageSize = 1000;
  const all: Pick[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("picks")
      .select("*")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    all.push(...(data as Pick[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

type ExistingMatch = {
  id: number;
  home_score: number | null;
  away_score: number | null;
  status: string;
  match_events: MatchEvent[] | null;
  home_team_id: number;
  away_team_id: number;
};

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const fixtures = await fetchWorldCupFixtures();

  const { data: existingMatches } = await supabase
    .from("matches")
    .select("id, home_score, away_score, status, match_events, home_team_id, away_team_id");

  const existingById = new Map<number, ExistingMatch>(
    (existingMatches ?? []).map((m) => [
      m.id,
      {
        ...m,
        match_events: (m.match_events as MatchEvent[] | null) ?? [],
      },
    ])
  );

  const justFinishedMatchIds: number[] = [];
  let eventsNotified = 0;

  let groupFinishedCount = 0;
  let groupTotal = 0;

  for (const f of fixtures) {
    const stage = parseStage(f.league.round);
    if (stage === "group") groupTotal++;

    const homeScore = f.goals.home ?? f.score.fulltime.home;
    const awayScore = f.goals.away ?? f.score.fulltime.away;
    const finished = isMatchFinished(f.fixture.status.short);
    const status = f.fixture.status.short;
    const matchId = f.fixture.id;

    if (stage === "group" && finished) groupFinishedCount++;

    const oldMatch = existingById.get(matchId) ?? null;
    const groupOrRound = parseGroupName(f.league.round) ?? f.league.round;

    let matchEvents: MatchEvent[] = oldMatch?.match_events ?? [];
    if (shouldFetchEvents(status, oldMatch, homeScore, awayScore)) {
      try {
        const rawEvents = await fetchFixtureEvents(matchId);
        matchEvents = parseFixtureEvents(
          rawEvents,
          f.teams.home.id
        );
      } catch (err) {
        console.error(`Failed to fetch events for match ${matchId}:`, err);
      }
    }

    const newEvents = findNewEvents(oldMatch?.match_events, matchEvents);
    const bootstrap = shouldBootstrapEvents(oldMatch?.match_events, matchEvents);

    if (isDiscordConfigured()) {
      eventsNotified += await notifyMatchEvents({
        oldMatch,
        homeTeam: f.teams.home.name,
        awayTeam: f.teams.away.name,
        homeScore,
        awayScore,
        status,
        groupOrRound,
        newEvents,
        bootstrap,
      });

      if (shouldNotifyFullTime(oldMatch, status)) {
        justFinishedMatchIds.push(matchId);
        await notifyFullTime({
          home_team_name: f.teams.home.name,
          away_team_name: f.teams.away.name,
          home_score: homeScore,
          away_score: awayScore,
          group_name: parseGroupName(f.league.round),
          round: f.league.round,
        });
      }
    }

    await supabase.from("matches").upsert(
      {
        id: matchId,
        round: f.league.round,
        group_name: parseGroupName(f.league.round),
        stage,
        home_team_id: f.teams.home.id,
        home_team_name: f.teams.home.name,
        home_team_logo: f.teams.home.logo,
        away_team_id: f.teams.away.id,
        away_team_name: f.teams.away.name,
        away_team_logo: f.teams.away.logo,
        kickoff_at: f.fixture.date,
        status,
        home_score: homeScore,
        away_score: awayScore,
        winning_goal_minute: null,
        match_events: matchEvents,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  }

  const groupComplete =
    groupTotal > 0 && groupFinishedCount === groupTotal;

  await supabase
    .from("app_settings")
    .update({
      knockout_unlocked: groupComplete,
      group_stage_complete: groupComplete,
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  // Score finished matches
  const { data: finishedMatches } = await supabase
    .from("matches")
    .select("*")
    .in("status", ["FT", "AET", "PEN"]);

  for (const match of finishedMatches ?? []) {
    const { data: unscoredPicks } = await supabase
      .from("picks")
      .select("*")
      .eq("match_id", match.id)
      .eq("is_scored", false);

    for (const pick of unscoredPicks ?? []) {
      const points = scorePick(match, pick);

      await supabase
        .from("picks")
        .update({ points_earned: points, is_scored: true })
        .eq("id", pick.id);
    }
  }

  // Rebuild leaderboard from scored picks only — no pick row means 0 for that match.
  const [{ data: profiles }, allPicks, { data: finishedForStreak }] =
    await Promise.all([
      supabase.from("profiles").select("id"),
      fetchAllPicks(supabase),
      supabase
        .from("matches")
        .select("*")
        .in("status", ["FT", "AET", "PEN"])
        .order("kickoff_at", { ascending: true }),
    ]);

  const picksByUser = new Map<string, Pick[]>();
  for (const pick of allPicks) {
    const list = picksByUser.get(pick.user_id) ?? [];
    list.push(pick);
    picksByUser.set(pick.user_id, list);
  }

  for (const profile of profiles ?? []) {
    const userPicks = picksByUser.get(profile.id) ?? [];
    const { total_points, total_wins } = aggregateProfileStats(userPicks);
    const current_streak = computeCurrentStreak(
      finishedForStreak ?? [],
      userPicks
    );

    await supabase
      .from("profiles")
      .update({ total_points, total_wins, current_streak })
      .eq("id", profile.id);
  }

  let leaderboardsPosted = 0;
  if (isDiscordConfigured() && justFinishedMatchIds.length > 0) {
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select(
        "display_name, username, total_points, total_wins, current_streak"
      );

    const leaders = topStandings(allProfiles ?? [], 10);

    if (leaders.length > 0) {
      const posted = await postDiscordLeaderboard(leaders);
      if (posted) leaderboardsPosted = 1;
    }
  }

  return NextResponse.json({
    ok: true,
    synced: fixtures.length,
    groupComplete,
    discord: {
      configured: isDiscordConfigured(),
      goalsNotified: eventsNotified,
      fullTimeMatches: justFinishedMatchIds.length,
      leaderboardsPosted,
    },
  });
}
