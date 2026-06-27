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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function fetchAllPicks() {
  const pageSize = 1000;
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("picks")
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

const allPicks = await fetchAllPicks();
const { data: profiles } = await supabase
  .from("profiles")
  .select("id, username, total_points, total_wins");

const picksByUser = new Map();
for (const pick of allPicks) {
  const list = picksByUser.get(pick.user_id) ?? [];
  list.push(pick);
  picksByUser.set(pick.user_id, list);
}

let updated = 0;
for (const profile of profiles ?? []) {
  const userPicks = picksByUser.get(profile.id) ?? [];
  let total_points = 0;
  let total_wins = 0;
  for (const pick of userPicks) {
    if (!pick.is_scored) continue;
    total_points += pick.points_earned ?? 0;
    if ((pick.points_earned ?? 0) > 0) total_wins++;
  }
  if (
    total_points === profile.total_points &&
    total_wins === (profile.total_wins ?? 0)
  ) {
    continue;
  }
  const { error } = await supabase
    .from("profiles")
    .update({ total_points, total_wins })
    .eq("id", profile.id);
  if (error) {
    console.error(profile.username, error.message);
    continue;
  }
  updated++;
  console.log(
    `${profile.username}: ${profile.total_points} -> ${total_points} pts`
  );
}

console.log(`Updated ${updated} profiles from ${allPicks.length} picks.`);
