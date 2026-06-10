export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export function validateUsername(
  input: string
): { ok: true; username: string } | { ok: false; error: string } {
  const username = normalizeUsername(input);
  if (username.length < 3 || username.length > 20) {
    return {
      ok: false,
      error: "Username must be 3–20 letters, numbers, or underscores.",
    };
  }
  return { ok: true, username };
}

export function isDuplicateUsernameError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("already") ||
    lower.includes("exists") ||
    lower.includes("duplicate") ||
    lower.includes("unique")
  );
}
