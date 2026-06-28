import { KnockoutBracketNotice } from "@/components/KnockoutBracketNotice";
import {
  isKnockoutBracketLocked,
  isKnockoutBracketOpen,
} from "@/lib/knockout-bracket";
import { fetchBracketSlotPicksForUser } from "@/lib/bracket-slot-pick-db";
import {
  EXPECTED_KNOCKOUT_FIXTURES,
  getKnockoutBracketProgress,
} from "@/lib/knockout-bracket-layout";
import { createClient } from "@/lib/supabase/server";

/** Site-wide knockout bracket notice for logged-in players (web + mobile). */
export async function KnockoutBracketNoticeGate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: matches }, { data: picks }, { picks: slotPicks }] =
    await Promise.all([
      supabase
        .from("matches")
        .select("id, stage, round, kickoff_at, status"),
      supabase.from("picks").select("match_id").eq("user_id", user.id),
      fetchBracketSlotPicksForUser(supabase, user.id),
    ]);

  const allMatches = matches ?? [];

  if (!isKnockoutBracketOpen(allMatches)) {
    return null;
  }

  const progress = getKnockoutBracketProgress(
    allMatches,
    picks ?? [],
    slotPicks
  );

  return (
    <KnockoutBracketNotice
      bracketLocked={isKnockoutBracketLocked(allMatches)}
      bracketComplete={progress.complete}
      matches={allMatches}
      picksOnSynced={progress.picksOnSynced}
      slotPicksMade={progress.slotPicksMade}
      syncedFixtures={progress.syncedFixtures}
      expectedFixtures={EXPECTED_KNOCKOUT_FIXTURES}
    />
  );
}
