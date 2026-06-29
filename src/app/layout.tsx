import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Bebas_Neue, Inter } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bebas.variable} ${inter.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
