import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(process.cwd(), ".env.local");
const env = fs.readFileSync(envPath, "utf8");
for (const line of env.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    v = v.slice(1, -1);
  process.env[t.slice(0, eq).trim()] = v;
}

const matchId = Number(process.argv[2] ?? 1561329);
const usernames = process.argv.slice(3);
if (!usernames.length) {
  console.error("Usage: node scripts/fix-knockout-points.mjs [matchId] user1 user2 ...");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: match } = await supabase
  .from("matches")
  .select("id, home_score, away_score, stage, round")
  .eq("id", matchId)
  .single();

for (const username of usernames) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", username)
    .single();
  if (!profile) {
    console.error("No profile:", username);
    continue;
  }
  const { data: pick } = await supabase
    .from("picks")
    .select("id, picked_winner, home_score_pred, away_score_pred, points_earned")
    .eq("user_id", profile.id)
    .eq("match_id", matchId)
    .single();
  if (!pick) {
    console.error("No pick:", username);
    continue;
  }

  const actual =
    match.home_score > match.away_score
      ? "home"
      : match.away_score > match.home_score
        ? "away"
        : "draw";

  let points = 0;
  if (pick.picked_winner === actual) {
    points = 4; // Ro32 knockout winner
    if (
      pick.home_score_pred === match.home_score &&
      pick.away_score_pred === match.away_score
    ) {
      points += 5;
    }
  }

  await supabase
    .from("picks")
    .update({ points_earned: points, is_scored: true })
    .eq("id", pick.id);

  console.log(`${username}: ${pick.points_earned} -> ${points}`);
}
