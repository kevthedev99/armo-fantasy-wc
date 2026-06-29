import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fetchAllTableRows } from "./lib/supabase-paginate.mjs";

const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  let v = t.slice(eq + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  process.env[t.slice(0, eq).trim()] = v;
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const KNOCKOUT_ROUND_COLUMNS = [
  { id: "ro32", apiRounds: ["Round of 32", "8th Finals"], expectedSlots: 16 },
  { id: "r16", apiRounds: ["Round of 16"], expectedSlots: 8 },
  { id: "qf", apiRounds: ["Quarter-finals"], expectedSlots: 4 },
  { id: "sf", apiRounds: ["Semi-finals"], expectedSlots: 2 },
  { id: "final", apiRounds: ["Final"], expectedSlots: 1 },
  { id: "third", apiRounds: ["3rd Place Final", "Third place"], expectedSlots: 1 },
];

const EXPECTED_KNOCKOUT_FIXTURES = 32;

function bracketSlotPickKey(roundId, slotIndex) {
  return `${roundId}:${slotIndex}`;
}

function matchBelongsToColumn(match, column) {
  return column.apiRounds.includes(match.round);
}

function groupKnockoutMatches(matches) {
  const knockout = matches
    .filter((m) => m.stage === "knockout")
    .sort(
      (a, b) =>
        new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
    );
  const grouped = new Map();
  for (const column of KNOCKOUT_ROUND_COLUMNS) {
    grouped.set(
      column.id,
      knockout.filter((m) => matchBelongsToColumn(m, column))
    );
  }
  return grouped;
}

function teamPreviewFromMatchSide(match, side) {
  if (side === "home") {
    return {
      id: match.home_team_id,
      name: match.home_team_name,
      logo: match.home_team_logo,
    };
  }
  return {
    id: match.away_team_id,
    name: match.away_team_name,
    logo: match.away_team_logo,
  };
}

function winnerFromMatchPick(match, pick) {
  if (!pick) return null;
  if (pick.picked_winner === "home") return teamPreviewFromMatchSide(match, "home");
  if (pick.picked_winner === "away") return teamPreviewFromMatchSide(match, "away");
  return null;
}

function winnerFromSlotPick(slotPick, homeTeam, awayTeam) {
  if (!slotPick || !homeTeam || !awayTeam) return null;
  if (slotPick.picked_winner === "home") return homeTeam;
  if (slotPick.picked_winner === "away") return awayTeam;
  return null;
}

function buildColumnSlots(
  column,
  roundMatches,
  feederWinners,
  pickMap,
  slotPickMap
) {
  const slots = [];
  const winners = [];

  for (let i = 0; i < column.expectedSlots; i++) {
    const match = roundMatches[i];
    if (match) {
      const pick = pickMap.get(match.id);
      slots.push({ kind: "match", match, slotIndex: i, columnId: column.id });
      winners.push(winnerFromMatchPick(match, pick));
    } else {
      const homeTeam = feederWinners?.[i * 2] ?? null;
      const awayTeam = feederWinners?.[i * 2 + 1] ?? null;
      const slotPick = slotPickMap.get(bracketSlotPickKey(column.id, i));
      const pickable = column.id !== "ro32" && !!homeTeam && !!awayTeam;
      slots.push({
        kind: "placeholder",
        columnId: column.id,
        slotIndex: i,
        homeTeam,
        awayTeam,
        pickable,
        slotPick,
      });
      winners.push(winnerFromSlotPick(slotPick, homeTeam, awayTeam));
    }
  }

  return { slots, winners };
}

function evaluateUserBracket(matches, picks, slotPicks) {
  const grouped = groupKnockoutMatches(matches);
  const pickMap = new Map(picks.map((p) => [p.match_id, p]));
  const slotPickMap = new Map(
    slotPicks.map((p) => [bracketSlotPickKey(p.round_id, p.slot_index), p])
  );

  let feederWinners = null;
  let pickableSlots = 0;
  let pickableFilled = 0;
  let syncedSlots = 0;
  let syncedFilled = 0;
  let totalFilled = 0;

  for (const column of KNOCKOUT_ROUND_COLUMNS) {
    const roundMatches = grouped.get(column.id) ?? [];
    const { slots, winners } = buildColumnSlots(
      column,
      roundMatches,
      feederWinners,
      pickMap,
      slotPickMap
    );
    feederWinners = winners;

    for (const slot of slots) {
      if (slot.kind === "match") {
        syncedSlots++;
        if (pickMap.has(slot.match.id)) {
          syncedFilled++;
          totalFilled++;
        }
      } else if (slot.pickable) {
        pickableSlots++;
        if (slot.slotPick) {
          pickableFilled++;
          totalFilled++;
        }
      }
    }
  }

  const knockoutMatchIds = new Set(
    matches.filter((m) => m.stage === "knockout").map((m) => m.id)
  );
  const knockoutPickCount = picks.filter((p) =>
    knockoutMatchIds.has(p.match_id)
  ).length;

  return {
    syncedSlots,
    syncedFilled,
    pickableSlots,
    pickableFilled,
    pickableTotal: syncedSlots + pickableSlots,
    pickableFilledTotal: syncedFilled + pickableFilled,
    slotPickCount: slotPicks.length,
    knockoutPickCount,
    totalFilled,
    completeOnSynced:
      syncedSlots > 0 && syncedFilled >= syncedSlots,
    completeOnPickable:
      syncedSlots + pickableSlots > 0 &&
      syncedFilled + pickableFilled >= syncedSlots + pickableSlots,
    completeFull32: totalFilled >= EXPECTED_KNOCKOUT_FIXTURES,
  };
}

async function fetchSlotPicksSafe() {
  try {
    const rows = await fetchAllTableRows(sb, "bracket_slot_picks", "*", "user_id");
    return { rows, tableMissing: false };
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : String(error);
    if (message.toLowerCase().includes("bracket_slot_picks")) {
      return { rows: [], tableMissing: true };
    }
    throw error;
  }
}

const [profiles, matches, picks, slotPickResult] = await Promise.all([
  fetchAllTableRows(sb, "profiles", "id, username, display_name", "username"),
  sb
    .from("matches")
    .select(
      "id, stage, round, kickoff_at, home_team_id, away_team_id, home_team_name, away_team_name, home_team_logo, away_team_logo"
    )
    .then((r) => {
      if (r.error) throw r.error;
      return r.data ?? [];
    }),
  fetchAllTableRows(sb, "picks", "user_id, match_id, picked_winner", "id"),
  fetchSlotPicksSafe(),
]);

const slotTableMissing = slotPickResult.tableMissing;
const slotPickRows = slotPickResult.rows;

const picksByUser = new Map();
for (const pick of picks) {
  if (!picksByUser.has(pick.user_id)) picksByUser.set(pick.user_id, []);
  picksByUser.get(pick.user_id).push(pick);
}

const slotPicksByUser = new Map();
if (!slotTableMissing) {
  for (const sp of slotPickRows ?? []) {
    if (!slotPicksByUser.has(sp.user_id)) slotPicksByUser.set(sp.user_id, []);
    slotPicksByUser.get(sp.user_id).push(sp);
  }
}

const allMatches = matches;
const syncedKnockoutCount = allMatches.filter((m) => m.stage === "knockout").length;

const results = profiles.map((profile) => {
  const userPicks = picksByUser.get(profile.id) ?? [];
  const userSlotPicks = slotPicksByUser.get(profile.id) ?? [];
  const stats = evaluateUserBracket(allMatches, userPicks, userSlotPicks);

  return {
    username: profile.username,
    display_name: profile.display_name,
    ...stats,
  };
});

const completePickable = results
  .filter((r) => r.completeOnPickable)
  .sort((a, b) => a.username.localeCompare(b.username));

const incomplete = results
  .filter((r) => !r.completeOnPickable)
  .sort(
    (a, b) =>
      b.pickableFilledTotal - a.pickableFilledTotal ||
      a.username.localeCompare(b.username)
  );

const notStarted = results.filter(
  (r) => r.knockoutPickCount === 0 && r.slotPickCount === 0
);

console.log(
  JSON.stringify(
    {
      summary: {
        totalUsers: results.length,
        totalPicksInDb: picks.length,
        syncedKnockoutFixturesInDb: syncedKnockoutCount,
        expectedFullBracketSlots: EXPECTED_KNOCKOUT_FIXTURES,
        completeAllPickableBracketSlots: completePickable.length,
        incompleteBracket: incomplete.length,
        notStarted: notStarted.length,
        slotPicksTableAvailable: !slotTableMissing,
        note:
          "Complete = picked every knockout slot that is available right now (synced Ro32 fixtures + later rounds where both teams are known from your bracket path). Full 32/32 is only possible once every slot is determined.",
      },
      completeKnockoutBracket: completePickable.map((r) => ({
        username: r.username,
        display_name: r.display_name,
        filled: `${r.pickableFilledTotal}/${r.pickableTotal}`,
        syncedRo32: `${r.syncedFilled}/${r.syncedSlots}`,
        laterRoundsSlotPicks: r.slotPickCount,
      })),
      incompleteKnockoutBracket: incomplete.map((r) => ({
        username: r.username,
        display_name: r.display_name,
        filled: `${r.pickableFilledTotal}/${r.pickableTotal}`,
        missing: r.pickableTotal - r.pickableFilledTotal,
        syncedRo32: `${r.syncedFilled}/${r.syncedSlots}`,
        laterRoundsSlotPicks: r.slotPickCount,
      })),
      notStarted: notStarted.map((r) => ({
        username: r.username,
        display_name: r.display_name,
      })),
    },
    null,
    2
  )
);
