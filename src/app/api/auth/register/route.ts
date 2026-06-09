import { NextResponse } from "next/server";
import { usernameToEmail } from "@/lib/auth-email";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const AVATAR_COLORS = [
  "#FF007A",
  "#32CD32",
  "#FFD700",
  "#0056b3",
  "#FF6B35",
  "#9B59B6",
  "#00CED1",
  "#E74C3C",
];

export async function POST(request: Request) {
  const body = await request.json();
  const { username, password, inviteCode } = body as {
    username?: string;
    password?: string;
    inviteCode?: string;
  };

  if (!username || !password || !inviteCode) {
    return NextResponse.json(
      { error: "Username, password, and invite code are required." },
      { status: 400 }
    );
  }

  if (inviteCode !== process.env.INVITE_CODE) {
    return NextResponse.json({ error: "Invalid invite code." }, { status: 403 });
  }

  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (cleanUsername.length < 3 || cleanUsername.length > 20) {
    return NextResponse.json(
      { error: "Username must be 3–20 letters, numbers, or underscores." },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  const email = usernameToEmail(cleanUsername);
  const service = createServiceClient();

  const { data: authData, error: authError } =
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: cleanUsername },
    });

  if (authError) {
    const message =
      authError.message.includes("already") ||
      authError.message.includes("exists")
        ? "Username already taken."
        : authError.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!authData.user) {
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }

  const color =
    AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  const { error: profileError } = await service.from("profiles").insert({
    id: authData.user.id,
    username: cleanUsername,
    display_name: username.trim(),
    avatar_color: color,
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return NextResponse.json(
      { error: "Account created but login failed. Try logging in." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, username: cleanUsername });
}
