import { KnockoutBracketNotice } from "@/components/KnockoutBracketNotice";
import { isKnockoutBracketLocked } from "@/lib/knockout-bracket";
import { getKnockoutBracketProgress } from "@/lib/knockout-bracket-layout";
import { createClient } from "@/lib/supabase/server";

/** Site-wide knockout bracket notice for logged-in players (web + mobile). */
export async function KnockoutBracketNoticeGate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: matches }, { data: settings }, { data: picks }] =
    await Promise.all([
      supabase
        .from("matches")
        .select("id, stage, round, kickoff_at, status"),
      supabase.from("app_settings").select("knockout_unlocked").eq("id", 1).single(),
      supabase.from("picks").select("match_id").eq("user_id", user.id),
    ]);

  const allMatches = matches ?? [];
  const progress = getKnockoutBracketProgress(allMatches, picks ?? []);

  return (
    <KnockoutBracketNotice
      bracketLocked={isKnockoutBracketLocked(allMatches)}
      knockoutUnlocked={settings?.knockout_unlocked ?? false}
      matches={allMatches}
      picksOnSynced={progress.picksOnSynced}
      syncedFixtures={progress.syncedFixtures}
    />
  );
}
