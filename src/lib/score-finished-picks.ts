import { getKnockoutMatchIdsToRescore } from "@/lib/bracket-chaining";
import {
  buildBracketChainingContext,
  computeAllBracketSlotChaining,
} from "@/lib/bracket-slot-chaining";
import { rowToBracketSlotPick } from "@/lib/bracket-slot-pick-db";
import { isMatchFinished, scorePick } from "@/lib/scoring";
import type { BracketSlotPick, Match, Pick } from "@/lib/types";
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

async function buildKnockoutScoreContexts(
  supabase: SupabaseClient,
  userIds: string[],
  km: Match[],
  knockoutPicksByUser: Map<string, Map<number, Pick>>
) {
  const contexts = new Map<string, NonNullable<Parameters<typeof scorePick>[2]>>();

  let slotPicksByUser = new Map<string, BracketSlotPick[]>();
  if (userIds.length > 0) {
    try {
      const slotRows = await fetchAllPages<Parameters<typeof rowToBracketSlotPick>[0]>(
        (from, to) =>
        supabase
          .from("bracket_slot_picks")
          .select("*")
          .in("user_id", userIds)
          .order("id", { ascending: true })
          .range(from, to)
      );
      for (const row of slotRows) {
        const pick = rowToBracketSlotPick(row);
        const list = slotPicksByUser.get(pick.user_id) ?? [];
        list.push(pick);
        slotPicksByUser.set(pick.user_id, list);
      }
    } catch {
      slotPicksByUser = new Map();
    }
  }

  for (const userId of userIds) {
    const userPicks = [
      ...(knockoutPicksByUser.get(userId)?.values() ?? []),
    ];
    const userSlotPicks = slotPicksByUser.get(userId) ?? [];
    const chainingCtx = buildBracketChainingContext(km, userPicks, userSlotPicks);
    const cache = computeAllBracketSlotChaining(chainingCtx);

    contexts.set(userId, {
      knockoutMatches: km,
      picksByMatchId: knockoutPicksByUser.get(userId) ?? new Map<number, Pick>(),
      bracketChaining: { ctx: chainingCtx, cache },
    });
  }

  return contexts;
}

/**
 * Score (or rescore) picks on finished matches. Knockout picks use NCAA-style
 * bracket chaining — bust paths score 0; forced paths require the chained winner.
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

  const knockoutScoreContexts = await buildKnockoutScoreContexts(
    supabase,
    [...usersWithKnockoutPicks],
    km,
    knockoutPicksByUser
  );

  for (const match of finishedMatches) {
    const picks = picksOnMatches.filter((p) => p.match_id === match.id);

    for (const pick of picks) {
      const context =
        match.stage === "knockout"
          ? knockoutScoreContexts.get(pick.user_id)
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

  const knockoutScoreContexts = await buildKnockoutScoreContexts(
    supabase,
    [...knockoutUsers],
    km,
    knockoutPicksByUser
  );

  for (const row of rows ?? []) {
    const joined = row.matches as Match | Match[] | null;
    const match = Array.isArray(joined) ? joined[0] : joined;
    if (!match || !isMatchFinished(match.status)) continue;

    const pick = row as Pick;
    const context =
      match.stage === "knockout"
        ? knockoutScoreContexts.get(pick.user_id)
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
