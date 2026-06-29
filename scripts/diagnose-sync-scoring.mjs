import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fetchAllTableRows } from "./lib/supabase-paginate.mjs";

const envPath = path.join(process.cwd(), ".env.local");
const env = fs.readFileSync(envPath, "utf8");
for (const line of env.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const FINISHED = ["FT", "AET", "PEN", "AWD", "WO"];
const LIVE = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"];

const [
  { data: settings },
  { data: stuckLive },
  { count: unscoredCount },
  { data: unscoredSample },
  { data: profiles },
  picks,
] = await Promise.all([
  supabase.from("app_settings").select("*").eq("id", 1).single(),
  supabase
    .from("matches")
    .select("id, home_team_name, away_team_name, status, home_score, away_score, kickoff_at, updated_at")
    .in("status", LIVE)
    .order("kickoff_at", { ascending: false })
    .limit(10),
  supabase
    .from("picks")
    .select("id", { count: "exact", head: true })
    .eq("is_scored", false),
  supabase
    .from("picks")
    .select("id, user_id, match_id, is_scored, points_earned, matches(home_team_name, away_team_name, status)")
    .eq("is_scored", false)
    .limit(15),
  supabase.from("profiles").select("id, username, total_points, total_wins").order("total_points", { ascending: false }).limit(10),
  fetchAllTableRows(
    supabase,
    "picks",
    "user_id, points_earned, is_scored",
    "id"
  ).then((rows) => rows.filter((p) => p.is_scored)),
]);

const pointsByUser = new Map();
for (const p of picks ?? []) {
  pointsByUser.set(p.user_id, (pointsByUser.get(p.user_id) ?? 0) + (p.points_earned ?? 0));
}

const mismatches = (profiles ?? [])
  .map((prof) => ({
    username: prof.username,
    profilePoints: prof.total_points,
    computedPoints: pointsByUser.get(prof.id) ?? 0,
    delta: prof.total_points - (pointsByUser.get(prof.id) ?? 0),
  }))
  .filter((r) => r.delta !== 0);

console.log(
  JSON.stringify(
    {
      last_sync_at: settings?.last_sync_at,
      last_full_sync_at: settings?.last_full_sync_at,
      stuckLiveCount: stuckLive?.length ?? 0,
      stuckLive: stuckLive?.map((m) => ({
        match: `${m.home_team_name} vs ${m.away_team_name}`,
        status: m.status,
        score: `${m.home_score}-${m.away_score}`,
        updated_at: m.updated_at,
      })),
      unscoredPicks: unscoredCount,
      unscoredSample: unscoredSample?.map((p) => {
        const m = Array.isArray(p.matches) ? p.matches[0] : p.matches;
        return {
          match: m ? `${m.home_team_name} vs ${m.away_team_name}` : p.match_id,
          matchStatus: m?.status,
          points_earned: p.points_earned,
        };
      }),
      topProfiles: profiles,
      standingsMismatches: mismatches,
    },
    null,
    2
  )
);
