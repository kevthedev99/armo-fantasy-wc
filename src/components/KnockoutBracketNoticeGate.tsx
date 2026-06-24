import { KnockoutBracketNotice } from "@/components/KnockoutBracketNotice";
import { isKnockoutBracketLocked } from "@/lib/knockout-bracket";
import { createClient } from "@/lib/supabase/server";

/** Site-wide knockout bracket notice for logged-in players (web + mobile). */
export async function KnockoutBracketNoticeGate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: matches } = await supabase
    .from("matches")
    .select("stage, round, kickoff_at, status");

  return (
    <KnockoutBracketNotice
      bracketLocked={isKnockoutBracketLocked(matches ?? [])}
    />
  );
}
