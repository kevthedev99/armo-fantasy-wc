const BRACKET_INSPECTOR_USERNAMES = new Set(["kevin"]);

/** League admins who can browse any player's knockout bracket on /bracket. */
export function canInspectAllBrackets(
  username: string | null | undefined
): boolean {
  if (!username) return false;
  return BRACKET_INSPECTOR_USERNAMES.has(username.toLowerCase());
}
