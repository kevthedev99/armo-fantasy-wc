import { NextResponse } from "next/server";
import { usernameToEmail } from "@/lib/auth-email";
import { normalizeUsername } from "@/lib/username";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { username, password } = body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 }
    );
  }

  const cleanUsername = normalizeUsername(username);
  const email = usernameToEmail(cleanUsername);
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
