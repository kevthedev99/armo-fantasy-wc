import { Nav } from "@/components/Nav";
import { RulesPage } from "@/components/RulesPage";
import { createClient } from "@/lib/supabase/server";

export default async function RulesRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single()
    : { data: null };

  return (
    <>
      <Nav username={profile?.username} />
      <RulesPage />
    </>
  );
}
