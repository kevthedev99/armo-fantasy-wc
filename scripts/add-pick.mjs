import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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

const username = process.argv[2]?.toLowerCase();
const homeTeamQuery = process.argv[3]?.toLowerCase();
const awayTeamQuery = process.argv[4]?.toLowerCase();
const homeScore = Number(process.argv[5]);
const awayScore = Number(process.argv[6]);

if (!username || !homeTeamQuery || !awayTeamQuery || !Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
  console.error(
    "Usage: node scripts/add-pick.mjs <username> <homeTeamSubstring> <awayTeamSubstring> <homeScore> <awayScore>"
  );
  process.exit(1);
}

function teamMatches(name, query) {
  return name.toLowerCase().includes(query);
}

function pickWinner(home, away) {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
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
  console.error(
    "Candidates:",
    (matches ?? []).map(
      (m) => `${m.id}: ${m.home_team_name} vs ${m.away_team_name} (${m.status})`
    )
  );
  process.exit(1);
}

let homeScorePred = homeScore;
let awayScorePred = awayScore;
let pickedWinner = pickWinner(homeScorePred, awayScorePred);

if (
  teamMatches(match.home_team_name, awayTeamQuery) &&
  teamMatches(match.away_team_name, homeTeamQuery)
) {
  homeScorePred = awayScore;
  awayScorePred = homeScore;
  pickedWinner = pickWinner(homeScorePred, awayScorePred);
}

const pickRow = {
  user_id: profile.id,
  match_id: match.id,
  picked_winner: pickedWinner,
  home_score_pred: match.stage === "group" ? homeScorePred : null,
  away_score_pred: match.stage === "group" ? awayScorePred : null,
  winning_goal_minute_pred: null,
  updated_at: new Date().toISOString(),
};

const { data: existing } = await supabase
  .from("picks")
  .select("id")
  .eq("user_id", profile.id)
  .eq("match_id", match.id)
  .maybeSingle();

let pick;
if (existing) {
  const { data, error } = await supabase
    .from("picks")
    .update(pickRow)
    .eq("id", existing.id)
    .select()
    .single();
  if (error) {
    console.error("Pick update failed:", error.message);
    process.exit(1);
  }
  pick = data;
} else {
  const { data, error } = await supabase
    .from("picks")
    .insert(pickRow)
    .select()
    .single();
  if (error) {
    console.error("Pick insert failed:", error.message);
    process.exit(1);
  }
  pick = data;
}

let pointsEarned = 0;
const finished = ["FT", "AET", "PEN", "AWD", "WO"].includes(match.status);
if (
  finished &&
  match.home_score !== null &&
  match.away_score !== null
) {
  const actual =
    match.home_score > match.away_score
      ? "home"
      : match.away_score > match.home_score
        ? "away"
        : "draw";
  if (pick.picked_winner === actual) {
    pointsEarned += 1;
    if (
      match.stage === "group" &&
      pick.home_score_pred === match.home_score &&
      pick.away_score_pred === match.away_score
    ) {
      pointsEarned += 5;
    }
  }

  await supabase
    .from("picks")
    .update({ points_earned: pointsEarned, is_scored: true })
    .eq("id", pick.id);

  const { data: allPicks } = await supabase
    .from("picks")
    .select("points_earned, is_scored")
    .eq("user_id", profile.id);

  let totalPoints = 0;
  let totalWins = 0;
  for (const p of allPicks ?? []) {
    if (!p.is_scored) continue;
    totalPoints += p.points_earned;
    if (p.points_earned > 0) totalWins++;
  }

  await supabase
    .from("profiles")
    .update({ total_points: totalPoints, total_wins: totalWins })
    .eq("id", profile.id);
}

console.log(
  JSON.stringify(
    {
      user: profile.username,
      match: `${match.home_team_name} vs ${match.away_team_name}`,
      matchId: match.id,
      status: match.status,
      pick: {
        picked_winner: pickedWinner,
        home_score_pred: homeScorePred,
        away_score_pred: awayScorePred,
      },
      pointsEarned: finished ? pointsEarned : "pending until FT",
      finalScore:
        match.home_score !== null
          ? `${match.home_score}-${match.away_score}`
          : null,
    },
    null,
    2
  )
);
