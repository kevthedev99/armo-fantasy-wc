import fs from "fs";
import path from "path";
import { createHmac } from "crypto";

const envPath = path.join(process.cwd(), ".env.local");
const env = fs.readFileSync(envPath, "utf8");
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

const secret = process.env.SHARE_LINK_SECRET ?? process.env.CRON_SECRET;
if (!secret) {
  console.error("Set SHARE_LINK_SECRET or CRON_SECRET in .env.local");
  process.exit(1);
}

const token = createHmac("sha256", secret)
  .update("picks-share:all")
  .digest("base64url")
  .slice(0, 24);

const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL?.startsWith("http")
    ? process.env.VERCEL_URL
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

const url = `${baseUrl.replace(/\/$/, "")}/share/picks?token=${encodeURIComponent(token)}`;

console.log(JSON.stringify({ token, url }, null, 2));
