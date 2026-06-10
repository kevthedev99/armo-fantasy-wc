import { NextResponse } from "next/server";
import { isDiscordConfigured, postDiscordTest } from "@/lib/discord";

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** POST once after adding DISCORD_WEBHOOK_URL to verify the channel connection. */
export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isDiscordConfigured()) {
    return NextResponse.json(
      { error: "DISCORD_WEBHOOK_URL is not set in environment variables." },
      { status: 400 }
    );
  }

  const ok = await postDiscordTest();
  if (!ok) {
    return NextResponse.json(
      { error: "Discord webhook request failed." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, message: "Test message sent." });
}
