import { NextResponse } from "next/server";
import {
  fetchFixturesForSync,
  fetchFixtureEvents,
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
  notifyKickoff,
  notifyMatchEvents,
  shouldNotifyFullTime,
  shouldNotifyKickoff,
} from "@/lib/match-notifications";
import {
  scoreFinishedMatchPicks,
  scoreUnscoredPickBackfill,
} from "@/lib/score-finished-picks";
import {
  aggregateProfileStats,
  computeCurrentStreak,
  isMatchFinished,
} from "@/lib/scoring";
import type { Match, MatchEvent, Pick } from "@/lib/types";
import { topStandings, computeRankChanges } from "@/lib/standings";
import { createServiceClient } from "@/lib/supabase/server";

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

const FULL_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

function shouldFullSync(
  request: Request,
  lastFullSyncAt: string | null | undefined
): boolean {
  const url = new URL(request.url);
  if (url.searchParams.get("full") === "1") return true;
  if (request.headers.get("x-vercel-cron") === "1") return true;
  if (!lastFullSyncAt) return true;
  return Date.now() - new Date(lastFullSyncAt).getTime() > FULL_SYNC_INTERVAL_MS;
}

function matchRowChanged(
  oldMatch: ExistingMatch | null,
  status: string,
  homeScore: number | null,
  awayScore: number | null,
  matchEvents: MatchEvent[]
): boolean {
  if (!oldMatch) return true;
  if (oldMatch.status !== status) return true;
  if (oldMatch.home_score !== homeScore) return true;
  if (oldMatch.away_score !== awayScore) return true;
  const prevEvents = oldMatch.match_events ?? [];
  if (prevEvents.length !== matchEvents.length) return true;
  return prevEvents.some((event, index) => event.id !== matchEvents[index]?.id);
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

async function fetchPicksForUsers(
  supabase: ReturnType<typeof createServiceClient>,
  userIds: string[]
): Promise<Pick[]> {
  if (userIds.length === 0) return [];

  const all: Pick[] = [];
  const chunkSize = 100;

  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("picks")
      .select("*")
      .in("user_id", chunk);

    if (error) throw error;
    all.push(...((data ?? []) as Pick[]));
  }

  return all;
}

function groupPicksByUser(picks: Pick[]): Map<string, Pick[]> {
  const map = new Map<string, Pick[]>();
  for (const pick of picks) {
    const list = map.get(pick.user_id) ?? [];
    list.push(pick);
    map.set(pick.user_id, list);
  }
  return map;
}

type ProfileStandingRow = {
  id: string;
  total_points: number;
  total_wins: number;
  current_streak: number;
  rank_change: number;
};

type RebuiltProfileStats = {
  total_points: number;
  total_wins: number;
  current_streak: number;
};

async function fetchFinishedMatchesForStreak(
  supabase: ReturnType<typeof createServiceClient>
): Promise<Match[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .in("status", ["FT", "AET", "PEN"])
    .order("kickoff_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Match[];
}

async function rebuildLeaderboard(params: {
  supabase: ReturnType<typeof createServiceClient>;
  affectedUserIds: Set<string>;
  gameJustFinished: boolean;
}): Promise<{ profilesUpdated: number }> {
  const { supabase, affectedUserIds, gameJustFinished } = params;

  const { data: profilesBeforeScoring, error: beforeError } = await supabase
    .from("profiles")
    .select("id, total_points, total_wins, current_streak, rank_change");

  if (beforeError) throw beforeError;

  const profiles = (profilesBeforeScoring ?? []) as ProfileStandingRow[];
  if (profiles.length === 0) return { profilesUpdated: 0 };

  const finishedForStreak = await fetchFinishedMatchesForStreak(supabase);
  const statsByUserId = new Map<string, RebuiltProfileStats>();

  if (gameJustFinished) {
    const allPicks = await fetchAllPicks(supabase);
    const picksByUser = groupPicksByUser(allPicks);

    for (const profile of profiles) {
      const userPicks = picksByUser.get(profile.id) ?? [];
      const { total_points, total_wins } = aggregateProfileStats(userPicks);
      statsByUserId.set(profile.id, {
        total_points,
        total_wins,
        current_streak: computeCurrentStreak(finishedForStreak, userPicks),
      });
    }
  } else {
    const picks = await fetchPicksForUsers(supabase, [...affectedUserIds]);
    const picksByUser = groupPicksByUser(picks);

    for (const userId of affectedUserIds) {
      const userPicks = picksByUser.get(userId) ?? [];
      const { total_points, total_wins } = aggregateProfileStats(userPicks);
      statsByUserId.set(userId, {
        total_points,
        total_wins,
        current_streak: computeCurrentStreak(finishedForStreak, userPicks),
      });
    }
  }

  const afterForRank = profiles.map((profile) => {
    const updated = statsByUserId.get(profile.id);
    return {
      id: profile.id,
      total_points: updated?.total_points ?? profile.total_points,
      total_wins: updated?.total_wins ?? profile.total_wins,
    };
  });

  const rankChanges = gameJustFinished
    ? computeRankChanges(profiles, afterForRank)
    : new Map<string, number>();

  let profilesUpdated = 0;

  for (const profile of profiles) {
    const updated = statsByUserId.get(profile.id);
    const update: {
      total_points?: number;
      total_wins?: number;
      current_streak?: number;
      rank_change?: number;
    } = {};

    if (updated) {
      if (updated.total_points !== profile.total_points) {
        update.total_points = updated.total_points;
      }
      if (updated.total_wins !== profile.total_wins) {
        update.total_wins = updated.total_wins;
      }
      if (updated.current_streak !== profile.current_streak) {
        update.current_streak = updated.current_streak;
      }
    }

    if (gameJustFinished) {
      const rankChange = rankChanges.get(profile.id) ?? 0;
      if (rankChange !== profile.rank_change) {
        update.rank_change = rankChange;
      }
    }

    if (Object.keys(update).length === 0) continue;

    const { error } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", profile.id);

    if (error) throw error;
    profilesUpdated++;
  }

  return { profilesUpdated };
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

  const { data: settings } = await supabase
    .from("app_settings")
    .select("last_full_sync_at")
    .eq("id", 1)
    .single();

  const fullSync = shouldFullSync(request, settings?.last_full_sync_at);
  const syncMode = fullSync ? "full" : "light";
  const fixtures = await fetchFixturesForSync(syncMode);

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
  const justFinishedGroupMatchIds: number[] = [];
  const justStartedMatchIds: number[] = [];
  let eventsNotified = 0;

  let groupFinishedCount = 0;
  let groupTotal = 0;
  let matchesUpserted = 0;

  for (const f of fixtures) {
    const stage = parseStage(f.league.round);
    const homeScore = f.goals.home ?? f.score.fulltime.home;
    const awayScore = f.goals.away ?? f.score.fulltime.away;
    const status = f.fixture.status.short;
    const matchId = f.fixture.id;

    const oldMatch = existingById.get(matchId) ?? null;
    const groupOrRound = parseGroupName(f.league.round) ?? f.league.round;

    let matchEvents: MatchEvent[] = oldMatch?.match_events ?? [];
    if (shouldFetchEvents(status, oldMatch, homeScore, awayScore)) {
      try {
        const rawEvents = await fetchFixtureEvents(matchId);
        matchEvents = parseFixtureEvents(rawEvents, f.teams.home.id);
      } catch (err) {
        console.error(`Failed to fetch events for match ${matchId}:`, err);
      }
    }

    const newEvents = findNewEvents(oldMatch?.match_events, matchEvents);
    const bootstrap = shouldBootstrapEvents(
      oldMatch?.match_events,
      matchEvents,
      status
    );

    if (shouldNotifyKickoff(oldMatch, status)) {
      justStartedMatchIds.push(matchId);
      if (isDiscordConfigured()) {
        await notifyKickoff(
          {
            home_team_name: f.teams.home.name,
            away_team_name: f.teams.away.name,
            group_name: parseGroupName(f.league.round),
            round: f.league.round,
          },
          status
        );
      }
    }

    if (shouldNotifyFullTime(oldMatch, status)) {
      justFinishedMatchIds.push(matchId);
      if (stage === "group") {
        justFinishedGroupMatchIds.push(matchId);
      }
      if (isDiscordConfigured()) {
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
    }

    if (
      matchRowChanged(oldMatch, status, homeScore, awayScore, matchEvents)
    ) {
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
      matchesUpserted++;
    }
  }

  let groupComplete = false;

  if (fullSync || justFinishedGroupMatchIds.length > 0) {
    const { data: groupStageMatches } = await supabase
      .from("matches")
      .select("status")
      .eq("stage", "group");

    for (const match of groupStageMatches ?? []) {
      groupTotal++;
      if (isMatchFinished(match.status)) groupFinishedCount++;
    }

    groupComplete = groupTotal > 0 && groupFinishedCount === groupTotal;
  } else {
    const { data: settingsRow } = await supabase
      .from("app_settings")
      .select("group_stage_complete")
      .eq("id", 1)
      .single();

    groupComplete = settingsRow?.group_stage_complete ?? false;
  }

  const nowIso = new Date().toISOString();

  const { count: knockoutCount } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("stage", "knockout");

  const knockoutUnlocked =
    groupComplete || (knockoutCount ?? 0) > 0;

  await supabase
    .from("app_settings")
    .update({
      knockout_unlocked: knockoutUnlocked,
      group_stage_complete: groupComplete,
      last_sync_at: nowIso,
      last_full_sync_at: fullSync ? nowIso : settings?.last_full_sync_at ?? null,
      updated_at: nowIso,
    })
    .eq("id", 1);

  if (justStartedMatchIds.length > 0) {
    const { error: clearError } = await supabase
      .from("profiles")
      .update({ rank_change: 0 })
      .not("id", "is", null);

    if (clearError) {
      console.error("Failed to clear rank_change on kickoff:", clearError);
    }
  }

  // Score picks only when needed — not every finished match on every tick.
  let picksScored = 0;
  const affectedUserIds = new Set<string>();

  if (justFinishedMatchIds.length > 0) {
    const scored = await scoreFinishedMatchPicks(
      supabase,
      justFinishedMatchIds
    );
    picksScored = scored.picksScored;
    scored.affectedUserIds.forEach((id) => affectedUserIds.add(id));
  } else {
    const { count: unscoredCount } = await supabase
      .from("picks")
      .select("id", { count: "exact", head: true })
      .eq("is_scored", false);

    if ((unscoredCount ?? 0) > 0) {
      const scored = await scoreUnscoredPickBackfill(supabase, 50);
      picksScored = scored.picksScored;
      scored.affectedUserIds.forEach((id) => affectedUserIds.add(id));
    }
  }

  const shouldRebuildLeaderboard =
    justFinishedMatchIds.length > 0 || picksScored > 0;

  let profilesUpdated = 0;
  if (shouldRebuildLeaderboard) {
    const result = await rebuildLeaderboard({
      supabase,
      affectedUserIds,
      gameJustFinished: justFinishedMatchIds.length > 0,
    });
    profilesUpdated = result.profilesUpdated;
  }

  let leaderboardsPosted = 0;
  if (isDiscordConfigured() && justFinishedMatchIds.length > 0) {
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select(
        "display_name, username, total_points, total_wins, current_streak, rank_change"
      );

    const leaders = topStandings(allProfiles ?? [], 10);

    if (leaders.length > 0) {
      const posted = await postDiscordLeaderboard(leaders);
      if (posted) leaderboardsPosted = 1;
    }
  }

  return NextResponse.json({
    ok: true,
    syncMode,
    fixturesFetched: fixtures.length,
    matchesUpserted,
    picksScored,
    profilesUpdated,
    leaderboardRebuilt: shouldRebuildLeaderboard,
    groupComplete,
    discord: {
      configured: isDiscordConfigured(),
      gameStartedMatches: justStartedMatchIds.length,
      goalsNotified: eventsNotified,
      fullTimeMatches: justFinishedMatchIds.length,
      leaderboardsPosted,
    },
  });
}
