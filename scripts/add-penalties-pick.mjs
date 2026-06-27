import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const PENALTIES_PICK_SENTINEL = 9999;

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

const username = process.argv[2]?.toLowerCase();
const homeTeamQuery = process.argv[3]?.toLowerCase();
const awayTeamQuery = process.argv[4]?.toLowerCase();
const penaltiesSide = process.argv[5]?.toLowerCase();

if (!username || !homeTeamQuery || !awayTeamQuery || !penaltiesSide) {
  console.error(
    "Usage: node scripts/add-penalties-pick.mjs <username> <homeTeamSubstring> <awayTeamSubstring> <home|away>"
  );
  process.exit(1);
}

if (penaltiesSide !== "home" && penaltiesSide !== "away") {
  console.error("Penalties winner must be 'home' or 'away' (relative to match home/away).");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function teamMatches(name, query) {
  return name.toLowerCase().includes(query);
}

const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("id, username, display_name")
  .eq("username", username)
  .maybeSingle();

if (profileError || !profile) {
  console.error("Profile not found:", username, profileError?.message);
  process.exit(1);
}

const { data: matches, error: matchError } = await supabase
  .from("matches")
  .select("*")
  .or(
    `home_team_name.ilike.%${homeTeamQuery}%,away_team_name.ilike.%${homeTeamQuery}%,home_team_name.ilike.%${awayTeamQuery}%,away_team_name.ilike.%${awayTeamQuery}%`
  );

if (matchError) {
  console.error("Match lookup failed:", matchError.message);
  process.exit(1);
}

const match = (matches ?? []).find(
  (m) =>
    (teamMatches(m.home_team_name, homeTeamQuery) &&
      teamMatches(m.away_team_name, awayTeamQuery)) ||
    (teamMatches(m.home_team_name, awayTeamQuery) &&
      teamMatches(m.away_team_name, homeTeamQuery))
);

if (!match) {
  console.error("Match not found for teams:", homeTeamQuery, "vs", awayTeamQuery);
  process.exit(1);
}

let pickedWinner = penaltiesSide;
if (
  teamMatches(match.home_team_name, awayTeamQuery) &&
  teamMatches(match.away_team_name, homeTeamQuery)
) {
  pickedWinner = penaltiesSide === "home" ? "away" : "home";
}

const pickRowWithColumn = {
  user_id: profile.id,
  match_id: match.id,
  picked_winner: pickedWinner,
  home_score_pred: null,
  away_score_pred: null,
  predicts_penalties: true,
  winning_goal_minute_pred: null,
  updated_at: new Date().toISOString(),
};

const pickRowLegacy = {
  user_id: profile.id,
  match_id: match.id,
  picked_winner: pickedWinner,
  home_score_pred: null,
  away_score_pred: null,
  winning_goal_minute_pred: PENALTIES_PICK_SENTINEL,
  updated_at: new Date().toISOString(),
};

const { data: existing } = await supabase
  .from("picks")
  .select("id")
  .eq("user_id", profile.id)
  .eq("match_id", match.id)
  .maybeSingle();

async function save(row) {
  if (existing) {
    return supabase.from("picks").update(row).eq("id", existing.id).select().single();
  }
  return supabase.from("picks").insert(row).select().single();
}

let { data: pick, error } = await save(pickRowWithColumn);
if (error?.message?.includes("predicts_penalties")) {
  ({ data: pick, error } = await save(pickRowLegacy));
}

if (error) {
  console.error("Pick save failed:", error.message);
  process.exit(1);
}

const winnerName =
  pickedWinner === "home" ? match.home_team_name : match.away_team_name;

console.log(
  JSON.stringify(
    {
      user: profile.username,
      match: `${match.home_team_name} vs ${match.away_team_name}`,
      matchId: match.id,
      pick: `${winnerName.toUpperCase()} ON PENS`,
      picked_winner: pickedWinner,
    },
    null,
    2
  )
);
