import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fetchAllPages } from "./lib/supabase-paginate.mjs";

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
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();

const picks = await fetchAllPages((from, to) =>
  supabase
    .from("picks")
    .select(
      "picked_winner, home_score_pred, away_score_pred, predicts_penalties, profiles!inner(username, display_name)"
    )
    .eq("match_id", matchId)
    .order("user_id", { ascending: true })
    .range(from, to)
);

const home = match.home_score;
const away = match.away_score;
const winner =
  home > away ? "home" : away > home ? "away" : "draw";

console.log(
  JSON.stringify(
    {
      match: `${match.home_team_name} vs ${match.away_team_name}`,
      status: match.status,
      finalScore: `${home}-${away}`,
      winner,
      totalPicks: picks.length,
      correctWinner: picks
        .filter((p) => p.picked_winner === winner)
        .map((p) => p.profiles.display_name || p.profiles.username),
      correctScore: picks
        .filter(
          (p) => p.home_score_pred === home && p.away_score_pred === away
        )
        .map((p) => ({
          name: p.profiles.display_name || p.profiles.username,
          username: p.profiles.username,
          pred: `${p.home_score_pred}-${p.away_score_pred}`,
        })),
      fw_grug: picks.find((p) => p.profiles.username === "fw_grug"),
    },
    null,
    2
  )
);
