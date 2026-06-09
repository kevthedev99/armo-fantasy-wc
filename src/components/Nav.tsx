"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface NavProps {
  username?: string;
}

export function Nav({ username }: NavProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="flex items-center justify-between bg-black px-4 py-3 text-white md:px-8">
      <Link href="/" className="text-sm font-black uppercase tracking-wider text-[#FFD700]">
        Armo Fantasy WC
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/" className="hover:text-[#FF007A]">
          Standings
        </Link>
        <Link href="/picks" className="hover:text-[#FF007A]">
          Picks
        </Link>
        <Link href="/rules" className="hover:text-[#FF007A]">
          Rules
        </Link>
        {username ? (
          <>
            <span className="text-gray-400">@{username}</span>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white"
            >
              Log out
            </button>
          </>
        ) : (
          <Link href="/login" className="text-[#32CD32]">
            Log in
          </Link>
        )}
      </div>
    </nav>
  );
}
