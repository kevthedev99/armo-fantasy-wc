import { createHmac, timingSafeEqual } from "crypto";

const PICKS_SHARE_SCOPE = "picks-share:all";

export function getShareLinkSecret(): string | null {
  return process.env.SHARE_LINK_SECRET ?? process.env.CRON_SECRET ?? null;
}

function createScopedShareToken(scope: string): string | null {
  const secret = getShareLinkSecret();
  if (!secret) return null;

  return createHmac("sha256", secret)
    .update(scope)
    .digest("base64url")
    .slice(0, 24);
}

function verifyScopedShareToken(
  scope: string,
  token: string | null | undefined
): boolean {
  const expected = createScopedShareToken(scope);
  if (!expected || !token) return false;
  if (token.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function createPicksShareToken(): string | null {
  return createScopedShareToken(PICKS_SHARE_SCOPE);
}

export function verifyPicksShareToken(token: string | null | undefined): boolean {
  return verifyScopedShareToken(PICKS_SHARE_SCOPE, token);
}

export function buildPicksShareUrl(baseUrl: string): string | null {
  const token = createPicksShareToken();
  if (!token) return null;
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/share/picks?token=${encodeURIComponent(token)}`;
}

export function createMatchShareToken(matchId: number): string | null {
  return createScopedShareToken(`match-share:${matchId}`);
}

export function verifyMatchShareToken(
  matchId: number,
  token: string | null | undefined
): boolean {
  const expected = createMatchShareToken(matchId);
  if (!expected || !token) return false;
  if (token.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function buildMatchShareUrl(matchId: number, baseUrl: string): string | null {
  const token = createMatchShareToken(matchId);
  if (!token) return null;
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/share/match/${matchId}?token=${encodeURIComponent(token)}`;
}
