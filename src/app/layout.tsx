import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Bebas_Neue, Inter } from "next/font/google";
import {
  BracketUpdateAlert,
  type LeaderboardEntry,
} from "@/components/BracketUpdateAlert";
import { topStandings } from "@/lib/standings";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Armo Fantasy World Cup",
  description: "Friends-only FIFA World Cup 2026 pick'em league",
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_color, total_points, total_wins"
    );

  const topTen: LeaderboardEntry[] = topStandings(profiles ?? [], 10);

  return (
    <html lang="en" className={`${bebas.variable} ${inter.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <BracketUpdateAlert topTen={topTen} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
