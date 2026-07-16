import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Bebas_Neue, Inter } from "next/font/google";
import {
  BracketUpdateAlert,
  type FinalAlertMatch,
} from "@/components/BracketUpdateAlert";
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

function toAlertMatch(
  row: {
    id: number;
    round: string;
    home_team_name: string;
    away_team_name: string;
    home_team_logo: string | null;
    away_team_logo: string | null;
    kickoff_at: string;
    status: string;
  } | null
): FinalAlertMatch | null {
  if (!row) return null;
  return {
    id: row.id,
    round: row.round,
    home_team_name: row.home_team_name,
    away_team_name: row.away_team_name,
    home_team_logo: row.home_team_logo,
    away_team_logo: row.away_team_logo,
    kickoff_at: row.kickoff_at,
    status: row.status,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: finaleMatches } = await supabase
    .from("matches")
    .select(
      "id, round, home_team_name, away_team_name, home_team_logo, away_team_logo, kickoff_at, status"
    )
    .or("round.eq.Final,round.eq.3rd Place Final,round.eq.Third place");

  const thirdPlace = toAlertMatch(
    finaleMatches?.find(
      (m) => m.round === "3rd Place Final" || m.round === "Third place"
    ) ?? null
  );
  const finalMatch = toAlertMatch(
    finaleMatches?.find((m) => m.round === "Final") ?? null
  );

  return (
    <html lang="en" className={`${bebas.variable} ${inter.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <BracketUpdateAlert thirdPlace={thirdPlace} finalMatch={finalMatch} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
