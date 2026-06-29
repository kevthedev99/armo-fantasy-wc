import { Nav } from "@/components/Nav";
import { KnockoutBracketView } from "@/components/KnockoutBracketView";
import { fetchBracketSlotPicksForUser } from "@/lib/bracket-slot-pick-db";
import { canInspectAllBrackets } from "@/lib/bracket-inspector";
import { normalizeUsername } from "@/lib/username";
import { createClient } from "@/lib/supabase/server";

type BracketRouteProps = {
  searchParams: Promise<{ user?: string }>;
};

export default async function BracketRoute({ searchParams }: BracketRouteProps) {
  const { user: viewAsUsername } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: currentProfile } = user
    ? await supabase
        .from("profiles")
        .select("id, username, display_name")
        .eq("id", user.id)
        .single()
    : { data: null };

  const isInspector = canInspectAllBrackets(currentProfile?.username);

  let viewedProfile = currentProfile;
  if (isInspector && viewAsUsername) {
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("username", normalizeUsername(viewAsUsername))
      .maybeSingle();
    if (targetProfile) {
      viewedProfile = targetProfile;
    }
  }

  const viewedUserId = viewedProfile?.id ?? user?.id ?? null;
  const readOnly =
    !!viewedProfile &&
    !!currentProfile &&
    viewedProfile.id !== currentProfile.id;

  const [
    { data: matches },
    { data: picks },
    { data: settings },
    slotPickResult,
    inspectorProfilesResult,
  ] = await Promise.all([
    supabase.from("matches").select("*").order("kickoff_at", { ascending: true }),
    viewedUserId
      ? supabase.from("picks").select("*").eq("user_id", viewedUserId)
      : Promise.resolve({ data: [] }),
    supabase
      .from("app_settings")
      .select("knockout_unlocked, group_stage_complete")
      .eq("id", 1)
      .single(),
    viewedUserId
      ? fetchBracketSlotPicksForUser(supabase, viewedUserId)
      : Promise.resolve({ picks: [], tableMissing: false }),
    isInspector
      ? supabase
          .from("profiles")
          .select("id, username, display_name")
          .order("display_name", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <>
      <Nav username={currentProfile?.username} />
      <KnockoutBracketView
        key={viewedUserId ?? "guest"}
        userId={readOnly ? null : (user?.id ?? null)}
        readOnly={readOnly}
        viewingProfile={readOnly ? viewedProfile : null}
        inspectorProfiles={
          isInspector ? (inspectorProfilesResult.data ?? []) : undefined
        }
        displayedUserId={viewedUserId}
        selfUsername={currentProfile?.username ?? null}
        matches={matches ?? []}
        picks={picks ?? []}
        initialSlotPicks={slotPickResult.picks}
        slotPicksTableMissing={slotPickResult.tableMissing}
        challengeSettings={settings}
      />
    </>
  );
}
