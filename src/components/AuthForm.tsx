"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PotDisplay } from "@/components/PotDisplay";
import { SponsorBanner } from "@/components/SponsorBanner";

interface AuthFormProps {
  mode: "login" | "register";
  playerCount: number;
}

export function AuthForm({ mode, playerCount }: AuthFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint =
      mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body =
      mode === "login"
        ? { username, password }
        : { username, password, inviteCode };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030806] px-4 py-12">
      {/* Pitch stripes */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, #32cd32 0px, #32cd32 80px, transparent 80px, transparent 160px)",
        }}
      />

      {/* Stadium glow orbs */}
      <div className="auth-glow pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#FF007A]/30 blur-[100px]" />
      <div
        className="auth-glow pointer-events-none absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-[#0056b3]/40 blur-[110px]"
        style={{ animationDelay: "1.5s" }}
      />
      <div
        className="auth-glow pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-[#FFD700]/20 blur-[90px]"
        style={{ animationDelay: "0.8s" }}
      />

      {/* Top accent bar */}
      <div className="pointer-events-none absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-[#FFD700] via-[#FF007A] to-[#32CD32]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Hero branding */}
        <div className="mb-8 text-center">
          <p className="text-xs font-bold tracking-[0.4em] text-[#FFD700]">
            ARMO FANTASY
          </p>
          <h1 className="font-display mt-2 text-5xl leading-none tracking-wide text-white">
            <span className="text-[#FFD700]">2026</span> PICK&apos;EM
          </h1>
          <p className="mt-1 text-lg font-black uppercase tracking-widest text-[#FF007A]">
            World Cup 2026
          </p>
          <PotDisplay
            playerCount={playerCount}
            className="mt-4 text-6xl sm:text-7xl"
          />
          <p className="auth-shimmer-text mt-3 text-sm font-bold uppercase tracking-wider">
            $25 Buy-In · Winner Takes All
          </p>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_0_60px_rgba(255,0,122,0.15)] backdrop-blur-xl"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FFD700]/60 to-transparent" />

          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black uppercase text-white">
                {mode === "login" ? "Welcome Back" : "Join the League"}
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                {mode === "login"
                  ? "Enter the arena. Your picks await."
                  : "Username + password. No email needed."}
              </p>
            </div>
            <span className="text-3xl" aria-hidden>
              ⚽
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#FFD700]/80">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-[#FF007A] focus:ring-1 focus:ring-[#FF007A]/50"
                placeholder="yourname"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#FFD700]/80">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-[#FF007A] focus:ring-1 focus:ring-[#FF007A]/50"
                placeholder="••••••••"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </div>
            {mode === "register" && (
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#FFD700]/80">
                  Invite Code
                </label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-[#32CD32] focus:ring-1 focus:ring-[#32CD32]/50"
                  placeholder="WC26"
                />
              </div>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-full bg-gradient-to-r from-[#FF007A] via-[#d4006a] to-[#FF007A] py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-[0_4px_24px_rgba(255,0,122,0.4)] transition hover:scale-[1.02] hover:shadow-[0_6px_32px_rgba(255,0,122,0.5)] disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading
              ? "Kicking off…"
              : mode === "login"
                ? "Enter the Pitch"
                : "Join the Squad"}
          </button>

          <p className="mt-6 text-center text-sm text-gray-500">
            {mode === "login" ? (
              <>
                New here?{" "}
                <Link
                  href="/register"
                  className="font-bold text-[#32CD32] hover:underline"
                >
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already in?{" "}
                <Link
                  href="/login"
                  className="font-bold text-[#32CD32] hover:underline"
                >
                  Log in
                </Link>
              </>
            )}
          </p>
        </form>

        <p className="mt-6 text-center text-[10px] font-medium uppercase tracking-[0.25em] text-gray-600">
          FIFA World Cup 2026 · USA · Mexico · Canada
        </p>

        <SponsorBanner variant="login" />
      </div>
    </div>
  );
}
