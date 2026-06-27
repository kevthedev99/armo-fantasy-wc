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

const FINISHED = ["FT", "AET", "PEN", "AWD", "WO"];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const baseUrl = process.argv[2] ?? "https://armowc26.xyz";

console.log(`Triggering production sync at ${baseUrl} ...`);
const res = await fetch(`${baseUrl}/api/cron/sync-matches`, {
  headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
});
const body = await res.json();
console.log(JSON.stringify({ status: res.status, body }, null, 2));

if (!res.ok) process.exit(1);

const { data: unscoredOnFinished } = await supabase
  .from("picks")
  .select("id, matches!inner(status)")
  .eq("is_scored", false)
  .in("matches.status", FINISHED);

console.log(
  "Unscored picks still on finished matches:",
  unscoredOnFinished?.length ?? 0
);
