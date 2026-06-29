import { getKnockoutMatchIdsToRescore } from "@/lib/bracket-chaining";
import { isMatchFinished, scorePick } from "@/lib/scoring";
import type { Match, Pick } from "@/lib/types";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type { SupabaseClient } from "@supabase/supabase-js";

type ScoreResult = {
  picksScored: number;
  affectedUserIds: Set<string>;
};

function groupPicksByUser(picks: Pick[]): Map<string, Pick[]> {
  const map = new Map<string, Pick[]>();
  for (const pick of picks) {
    const list = map.get(pick.user_id) ?? [];
    list.push(pick);
    map.set(pick.user_id, list);
  }
  return map;
}

/**
 * Score (or rescore) picks on finished matches. Knockout picks use Sleeper-style
 * team chaining — only teams you picked to win and lost are crossed out.
 */
export async function scoreFinishedMatchPicks(
  supabase: SupabaseClient,
  finishedMatchIds: number[]
): Promise<ScoreResult> {
  const affectedUserIds = new Set<string>();
  let picksScored = 0;

  if (finishedMatchIds.length === 0) {
    return { picksScored, affectedUserIds };
  }

  const { data: knockoutMatches } = await supabase
    .from("matches")
    .select("*")
    .eq("stage", "knockout");

  const km = knockoutMatches ?? [];
  const matchIdsToEvaluate = getKnockoutMatchIdsToRescore(
    finishedMatchIds,
    km
  );

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .in("id", [...matchIdsToEvaluate]);

  const finishedMatches = (matches ?? []).filter((m) =>
    isMatchFinished(m.status)
  );

  if (finishedMatches.length === 0) {
    return { picksScored, affectedUserIds };
  }

  const scoredMatchIds = finishedMatches.map((m) => m.id);
  const picksOnMatches = await fetchAllPages<Pick>((from, to) =>
    supabase
      .from("picks")
      .select("*")
      .in("match_id", scoredMatchIds)
      .order("id", { ascending: true })
      .range(from, to)
  );

  if (!picksOnMatches.length) {
    return { picksScored, affectedUserIds };
  }

  const knockoutMatchIds = km.map((m) => m.id);
  const usersWithKnockoutPicks = new Set(
    picksOnMatches
      .filter((p) => knockoutMatchIds.includes(p.match_id))
      .map((p) => p.user_id)
  );

  const knockoutPicksByUser = new Map<string, Map<number, Pick>>();
  if (usersWithKnockoutPicks.size > 0 && knockoutMatchIds.length > 0) {
    const allKnockoutPicks = await fetchAllPages<Pick>((from, to) =>
      supabase
        .from("picks")
        .select("*")
        .in("user_id", [...usersWithKnockoutPicks])
        .in("match_id", knockoutMatchIds)
        .order("id", { ascending: true })
        .range(from, to)
    );

    for (const [userId, userPicks] of groupPicksByUser(allKnockoutPicks)) {
      knockoutPicksByUser.set(
        userId,
        new Map(userPicks.map((p) => [p.match_id, p]))
      );
    }
  }

  for (const match of finishedMatches) {
    const picks = picksOnMatches.filter((p) => p.match_id === match.id);

    for (const pick of picks) {
      const context =
        match.stage === "knockout"
          ? {
              knockoutMatches: km,
              picksByMatchId:
                knockoutPicksByUser.get(pick.user_id) ??
                new Map<number, Pick>(),
            }
          : undefined;

      const points = scorePick(match as Match, pick, context);
      if (points !== pick.points_earned || !pick.is_scored) {
        await supabase
          .from("picks")
          .update({ points_earned: points, is_scored: true })
          .eq("id", pick.id);
        picksScored++;
        affectedUserIds.add(pick.user_id);
      }
    }
  }

  return { picksScored, affectedUserIds };
}

/** Score every pick on a finished match that is still marked unscored. */
export async function scoreAllPendingFinishedPicks(
  supabase: SupabaseClient
): Promise<ScoreResult> {
  const unscoredRows = await fetchAllPages<{ match_id: number }>((from, to) =>
    supabase
      .from("picks")
      .select("match_id")
      .eq("is_scored", false)
      .order("match_id", { ascending: true })
      .range(from, to)
  );

  const candidateMatchIds = [
    ...new Set(unscoredRows.map((row) => row.match_id)),
  ];

  if (candidateMatchIds.length === 0) {
    return { picksScored: 0, affectedUserIds: new Set() };
  }

  const { data: finishedMatches, error: finishedError } = await supabase
    .from("matches")
    .select("id")
    .in("id", candidateMatchIds)
    .in("status", ["FT", "AET", "PEN", "AWD", "WO"]);

  if (finishedError) throw finishedError;

  return scoreFinishedMatchPicks(
    supabase,
    (finishedMatches ?? []).map((match) => match.id)
  );
}

/** Backfill a small batch of unscored picks (group + knockout). */
export async function scoreUnscoredPickBackfill(
  supabase: SupabaseClient,
  limit = 50
): Promise<ScoreResult> {
  const { data: knockoutMatches } = await supabase
    .from("matches")
    .select("*")
    .eq("stage", "knockout");

  const km = knockoutMatches ?? [];
  const knockoutMatchIds = km.map((m) => m.id);

  const { data: rows } = await supabase
    .from("picks")
    .select("*, matches!inner(*)")
    .eq("is_scored", false)
    .in("matches.status", ["FT", "AET", "PEN", "AWD", "WO"])
    .limit(limit);

  const affectedUserIds = new Set<string>();
  let picksScored = 0;

  const knockoutUsers = new Set(
    (rows ?? [])
      .filter((row) => {
        const joined = row.matches as Match | Match[] | null;
        const match = Array.isArray(joined) ? joined[0] : joined;
        return match?.stage === "knockout";
      })
      .map((row) => row.user_id)
  );

  const knockoutPicksByUser = new Map<string, Map<number, Pick>>();
  if (knockoutUsers.size > 0 && knockoutMatchIds.length > 0) {
    const allKnockoutPicks = await fetchAllPages<Pick>((from, to) =>
      supabase
        .from("picks")
        .select("*")
        .in("user_id", [...knockoutUsers])
        .in("match_id", knockoutMatchIds)
        .order("id", { ascending: true })
        .range(from, to)
    );

    for (const [userId, userPicks] of groupPicksByUser(allKnockoutPicks)) {
      knockoutPicksByUser.set(
        userId,
        new Map(userPicks.map((p) => [p.match_id, p]))
      );
    }
  }

  for (const row of rows ?? []) {
    const joined = row.matches as Match | Match[] | null;
    const match = Array.isArray(joined) ? joined[0] : joined;
    if (!match || !isMatchFinished(match.status)) continue;

    const pick = row as Pick;
    const context =
      match.stage === "knockout"
        ? {
            knockoutMatches: km,
            picksByMatchId:
              knockoutPicksByUser.get(pick.user_id) ?? new Map<number, Pick>(),
          }
        : undefined;

    const points = scorePick(match, pick, context);
    await supabase
      .from("picks")
      .update({ points_earned: points, is_scored: true })
      .eq("id", pick.id);
    picksScored++;
    affectedUserIds.add(pick.user_id);
  }

  return { picksScored, affectedUserIds };
}
