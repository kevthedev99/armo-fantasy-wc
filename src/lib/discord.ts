const DISCORD_EMBED_GREEN = 0x32cd32;
const DISCORD_EMBED_BLUE = 0x0056b3;
const DISCORD_EMBED_GOLD = 0xffd700;

function webhookUrl(): string | null {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  return url && url.startsWith("https://discord.com/api/webhooks/")
    ? url
    : null;
}

export function isDiscordConfigured(): boolean {
  return webhookUrl() !== null;
}

async function postDiscord(body: object): Promise<boolean> {
  const url = webhookUrl();
  if (!url) return false;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("Discord webhook failed:", res.status, await res.text());
    return false;
  }

  return true;
}

export async function postDiscordGoal(params: {
  scorerName: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  statusLabel: string;
  groupOrRound?: string | null;
}): Promise<boolean> {
  const { scorerName, homeTeam, awayTeam, homeScore, awayScore, statusLabel } =
    params;
  const context = params.groupOrRound ? ` · ${params.groupOrRound}` : "";

  return postDiscord({
    embeds: [
      {
        title: "⚽ GOAL!",
        description: `**${scorerName}** scores!\n${homeTeam} **${homeScore}–${awayScore}** ${awayTeam}`,
        color: DISCORD_EMBED_GREEN,
        footer: { text: `${statusLabel}${context}` },
      },
    ],
  });
}

export async function postDiscordFullTime(params: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  groupOrRound?: string | null;
}): Promise<boolean> {
  const { homeTeam, awayTeam, homeScore, awayScore } = params;
  const context = params.groupOrRound ? ` · ${params.groupOrRound}` : "";

  return postDiscord({
    embeds: [
      {
        title: "🏁 FULL TIME",
        description: `${homeTeam} **${homeScore}–${awayScore}** ${awayTeam}`,
        color: DISCORD_EMBED_BLUE,
        footer: { text: `Armo Fantasy WC${context}` },
      },
    ],
  });
}

export async function postDiscordLeaderboard(
  leaders: { display_name: string; username: string; total_points: number }[]
): Promise<boolean> {
  if (leaders.length === 0) return false;

  const lines = leaders.map(
    (p, i) =>
      `**${i + 1}.** ${p.display_name} — **${p.total_points}** pts`
  );

  return postDiscord({
    embeds: [
      {
        title: "📊 LEADERBOARD — Top 5",
        description: lines.join("\n"),
        color: DISCORD_EMBED_GOLD,
        footer: { text: "Updated after full time · armowc26.xyz" },
      },
    ],
  });
}

export async function postDiscordTest(): Promise<boolean> {
  return postDiscord({
    content: "✅ Armo Fantasy WC Discord alerts are connected.",
  });
}
