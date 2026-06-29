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

const FINISHED = new Set(["FT", "AET", "PEN", "AWD", "WO"]);

const [{ data: profiles }, { data: matches }, picks] = await Promise.all([
    sb.from("profiles").select("id, username, display_name").order("username"),
    sb
      .from("matches")
      .select("id, stage, status, kickoff_at, home_team_name, away_team_name")
      .order("kickoff_at"),
    fetchAllTableRows(sb, "picks", "user_id, match_id", "id"),
  ]);

const group = (matches ?? []).filter((m) => m.stage === "group");
const groupIds = new Set(group.map((m) => m.id));
const stillPickable = group.filter(
  (m) =>
    !FINISHED.has(m.status) &&
    m.status === "NS" &&
    Date.now() < new Date(m.kickoff_at).getTime()
);

const picksByUser = new Map();
for (const pick of picks) {
  if (!picksByUser.has(pick.user_id)) picksByUser.set(pick.user_id, new Set());
  picksByUser.get(pick.user_id).add(pick.match_id);
}

const results = (profiles ?? []).map((profile) => {
  const userPicks = picksByUser.get(profile.id) ?? new Set();
  const groupPicked = [...groupIds].filter((id) => userPicks.has(id)).length;
  const openPicked = stillPickable.filter((m) => userPicks.has(m.id)).length;

  return {
    username: profile.username,
    display_name: profile.display_name,
    groupPicked,
    groupTotal: groupIds.size,
    missing: groupIds.size - groupPicked,
    complete: groupPicked === groupIds.size,
    stillPickableOpen: openPicked,
    stillPickableTotal: stillPickable.length,
    totalPicks: userPicks.size,
  };
});

const completeAll = results
  .filter((r) => r.complete)
  .sort((a, b) => a.username.localeCompare(b.username));

const incomplete = results
  .filter((r) => !r.complete)
  .sort((a, b) => b.groupPicked - a.groupPicked || a.username.localeCompare(b.username));

const zeroPicks = results.filter((r) => r.groupPicked === 0);

console.log(
  JSON.stringify(
    {
      summary: {
        totalUsers: results.length,
        completeAllGroupPicks: completeAll.length,
        incompleteGroupPicks: incomplete.length,
        usersWithZeroGroupPicks: zeroPicks.length,
        totalGroupMatches: groupIds.size,
        groupMatchesFinished: group.filter((m) => FINISHED.has(m.status)).length,
        groupMatchesStillPickable: stillPickable.length,
      },
      completeAllGroupPicks: completeAll.map((r) => ({
        username: r.username,
        display_name: r.display_name,
        groupPicks: `${r.groupPicked}/${r.groupTotal}`,
        totalPicks: r.totalPicks,
      })),
      incompleteGroupPicks: incomplete.map((r) => ({
        username: r.username,
        display_name: r.display_name,
        groupPicks: `${r.groupPicked}/${r.groupTotal}`,
        missing: r.missing,
        totalPicks: r.totalPicks,
      })),
      usersWithZeroGroupPicks: zeroPicks.map((r) => ({
        username: r.username,
        display_name: r.display_name,
      })),
    },
    null,
    2
  )
);
