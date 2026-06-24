"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { WorldCupLogo } from "@/components/WorldCupLogo";

interface NavProps {
  username?: string;
}

const MAIN_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Standings" },
  { href: "/games", label: "Games" },
  { href: "/picks", label: "Picks" },
  { href: "/rules", label: "Rules" },
  { href: "/casino", label: "Roulette" },
  { href: "/casino/blackjack", label: "Blackjack" },
];

export function Nav({ username }: NavProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/casino") return pathname === "/casino";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 bg-black px-4 py-3.5 text-white md:gap-4 md:px-8">
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 text-sm font-black uppercase tracking-wider text-[#FFD700] md:gap-2.5 md:text-base"
      >
        <WorldCupLogo className="h-7 w-auto object-contain md:h-8" />
        <span>Armo Fantasy WC</span>
      </Link>
      <div className="flex flex-wrap items-center gap-5 sm:gap-7 md:gap-8">
        {MAIN_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`text-sm font-semibold tracking-wide transition sm:text-base ${
              isActive(href)
                ? href.startsWith("/casino")
                  ? "text-[#FFD700]"
                  : "text-[#FF007A]"
                : href.startsWith("/casino")
                  ? "text-gray-300 hover:text-[#FFD700]"
                  : "text-gray-300 hover:text-[#FF007A]"
            }`}
          >
            {label}
          </Link>
        ))}
        {username ? (
          <>
            <Link
              href={`/player/${username}`}
              className="hidden text-sm text-gray-400 hover:text-white sm:inline md:text-base"
            >
              @{username}
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-white md:text-base"
            >
              Log out
            </button>
          </>
        ) : (
          <Link href="/login" className="text-sm text-[#32CD32] md:text-base">
            Log in
          </Link>
        )}
      </div>
    </nav>
  );
}
