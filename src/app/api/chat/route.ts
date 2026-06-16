import { NextResponse } from "next/server";
import {
  applyChatBodyForUser,
  canClearChat,
  CHAT_MAX_LENGTH,
  chatCutoffIso,
  sanitizeChatBody,
  type ChatMessage,
} from "@/lib/chat";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function purgeExpiredMessages(): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .lt("created_at", chatCutoffIso());

  if (error) {
    console.error("Chat purge failed:", error);
  }
}

async function fetchRecentMessages(): Promise<ChatMessage[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, username, body, created_at")
    .gte("created_at", chatCutoffIso())
    .order("created_at", { ascending: true })
    .limit(150);

  if (error) {
    throw error;
  }

  return (data ?? []) as ChatMessage[];
}

async function clearAllChatMessages(): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .gte("created_at", "1970-01-01");

  if (error) {
    throw error;
  }
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    await purgeExpiredMessages();
    const messages = await fetchRecentMessages();
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("Chat fetch failed:", err);
    return NextResponse.json(
      { error: "Could not load chat." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const raw =
    typeof payload.body === "string" ? payload.body : String(payload.body ?? "");

  if (raw.length > CHAT_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Message must be ${CHAT_MAX_LENGTH} characters or less.` },
      { status: 400 }
    );
  }

  const sanitized = sanitizeChatBody(raw);
  if (!sanitized) {
    return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.username) {
    return NextResponse.json({ error: "Profile not found." }, { status: 400 });
  }

  const body = applyChatBodyForUser(profile.username, sanitized);

  await purgeExpiredMessages();

  const { data: inserted, error: insertError } = await supabase
    .from("chat_messages")
    .insert({
      user_id: user.id,
      username: profile.username,
      body,
    })
    .select("id, username, body, created_at")
    .single();

  if (insertError || !inserted) {
    console.error("Chat insert failed:", insertError);
    return NextResponse.json({ error: "Could not send message." }, { status: 500 });
  }

  return NextResponse.json({ message: inserted as ChatMessage });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.username) {
    return NextResponse.json({ error: "Profile not found." }, { status: 400 });
  }

  if (!canClearChat(profile.username)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    await clearAllChatMessages();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Chat clear failed:", err);
    return NextResponse.json({ error: "Could not clear chat." }, { status: 500 });
  }
}
