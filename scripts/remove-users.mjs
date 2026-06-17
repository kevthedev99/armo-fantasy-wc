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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const usernames = process.argv.slice(2);

if (usernames.length === 0) {
  console.error("Usage: node scripts/remove-users.mjs <username> [username...]");
  process.exit(1);
}

let failed = false;

for (const username of usernames) {
  const { data: profile, error: lookupError } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  if (lookupError) {
    console.error(`Lookup failed for ${username}:`, lookupError.message);
    failed = true;
    continue;
  }

  if (!profile) {
    console.log(`Not found: ${username}`);
    continue;
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(profile.id);
  if (deleteError) {
    console.error(`Delete failed for ${username}:`, deleteError.message);
    failed = true;
    continue;
  }

  console.log(`Removed: ${profile.username} (${profile.display_name})`);
}

process.exit(failed ? 1 : 0);
