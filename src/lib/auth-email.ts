/** Internal email for Supabase Auth — users only see their username. */
export function usernameToEmail(username: string): string {
  return `${username}@armofantasy.gg`;
}
