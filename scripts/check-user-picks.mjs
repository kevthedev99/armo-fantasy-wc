import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const username = process.argv[2] ?? "christopher";
const { data: profile } = await sb
  .from("profiles")
  .select("id, username, total_points")
  .eq("username", username)
  .single();

const { data: picks } = await sb
  .from("picks")
  .select("match_id, is_scored, points_earned, picked_winner, home_score_pred, away_score_pred, matches(home_team_name, away_team_name, status, home_score, away_score)")
  .eq("user_id", profile.id);

const finished = (picks ?? []).filter((p) => {
  const m = Array.isArray(p.matches) ? p.matches[0] : p.matches;
  return ["FT", "AET", "PEN"].includes(m?.status);
});

console.log(
  JSON.stringify(
    {
      username: profile.username,
      total_points: profile.total_points,
      totalPicks: picks?.length,
      finishedPicks: finished.length,
      scoredFinished: finished.filter((p) => p.is_scored).length,
      sumScoredPoints: (picks ?? [])
        .filter((p) => p.is_scored)
        .reduce((s, p) => s + (p.points_earned ?? 0), 0),
      sample: finished.slice(0, 5).map((p) => {
        const m = Array.isArray(p.matches) ? p.matches[0] : p.matches;
        return {
          match: `${m?.home_team_name} vs ${m?.away_team_name}`,
          is_scored: p.is_scored,
          points_earned: p.points_earned,
          pick: p.picked_winner,
        };
      }),
    },
    null,
    2
  )
);
