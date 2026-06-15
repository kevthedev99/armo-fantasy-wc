import { ChatPage } from "@/components/ChatPage";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ChatRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (!profile?.username) {
    redirect("/login");
  }

  return (
    <>
      <Nav username={profile.username} />
      <ChatPage username={profile.username} />
    </>
  );
}
