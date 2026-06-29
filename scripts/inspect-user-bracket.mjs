import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const username = (process.argv[2] ?? "kevin").toLowerCase();

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

const { data: profile } = await sb
  .from("profiles")
  .select("id, username, display_name")
  .eq("username", username)
  .single();

if (!profile) {
  console.error("User not found:", username);
  process.exit(1);
}

const [{ data: picks }, { data: slotPicks }, { data: matches }] =
  await Promise.all([
    sb.from("picks").select("*").eq("user_id", profile.id),
    sb.from("bracket_slot_picks").select("*").eq("user_id", profile.id),
    sb
      .from("matches")
      .select("id, stage, round, kickoff_at, home_team_name, away_team_name")
      .order("kickoff_at"),
  ]);

const koIds = new Set(
  (matches ?? []).filter((m) => m.stage === "knockout").map((m) => m.id)
);

const knockoutPicks = (picks ?? []).filter((p) => koIds.has(p.match_id));
const groupPicks = (picks ?? []).filter((p) => !koIds.has(p.match_id));

const ro32 = (matches ?? []).filter(
  (m) =>
    m.stage === "knockout" &&
    (m.round === "Round of 32" || m.round === "8th Finals")
);

console.log(
  JSON.stringify(
    {
      user: profile,
      counts: {
        totalPicks: picks?.length ?? 0,
        groupPicks: groupPicks.length,
        knockoutPicksOnSyncedMatches: knockoutPicks.length,
        bracketSlotPicks: slotPicks?.length ?? 0,
        syncedRo32Fixtures: ro32.length,
      },
      knockoutPicks: knockoutPicks.map((p) => {
        const m = (matches ?? []).find((x) => x.id === p.match_id);
        return {
          match_id: p.match_id,
          round: m?.round,
          match: m ? `${m.home_team_name} vs ${m.away_team_name}` : "?",
          picked_winner: p.picked_winner,
          score: `${p.home_score_pred ?? "—"}-${p.away_score_pred ?? "—"}`,
          predicts_penalties: p.predicts_penalties,
        };
      }),
      bracketSlotPicks: (slotPicks ?? [])
        .sort(
          (a, b) =>
            a.round_id.localeCompare(b.round_id) || a.slot_index - b.slot_index
        )
        .map((s) => ({
          round_id: s.round_id,
          slot_index: s.slot_index,
          picked_winner: s.picked_winner,
          home_team_id: s.home_team_id,
          away_team_id: s.away_team_id,
          score: `${s.home_score_pred ?? "—"}-${s.away_score_pred ?? "—"}`,
          predicts_penalties: s.predicts_penalties,
        })),
      syncedRo32Fixtures: ro32.map((m, i) => ({
        slotIndex: i,
        id: m.id,
        round: m.round,
        match: `${m.home_team_name} vs ${m.away_team_name}`,
        hasPick: knockoutPicks.some((p) => p.match_id === m.id),
      })),
    },
    null,
    2
  )
);
