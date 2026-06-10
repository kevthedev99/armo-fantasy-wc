import { createServiceClient } from "@/lib/supabase/server";

/** Player count for prize pool — uses service role so login/register (anon) can read it. */
export async function getPlayerCount(): Promise<number> {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("getPlayerCount:", error.message);
    return 0;
  }

  return count ?? 0;
}
