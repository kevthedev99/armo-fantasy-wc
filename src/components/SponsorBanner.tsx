/* eslint-disable @next/next/no-img-element */

const SPONSORS = [
  {
    name: "Iron Crest Roofing",
    src: "/sponsors/iron-crest-roofing.png",
    lightBg: false,
  },
  {
    name: "Pasadena Tutoring Co.",
    src: "/sponsors/pasadena-tutoring-co.png",
    lightBg: false,
  },
  {
    name: "Lyon Shoe Repair",
    src: "/sponsors/lyon-shoe-repair.png",
    lightBg: true,
  },
] as const;

function sponsorTileClass(lightBg: boolean, isLogin: boolean): string {
  if (lightBg) return "bg-[#f5f0e8]";
  return isLogin ? "bg-black/40" : "bg-[#111]";
}

interface SponsorBannerProps {
  variant?: "login" | "standings";
}

export function SponsorBanner({ variant = "login" }: SponsorBannerProps) {
  const isLogin = variant === "login";

  return (
    <aside
      className={`w-full ${
        isLogin ? "mt-10" : "mt-10 border-t border-gray-800 pt-8"
      }`}
      aria-label="League sponsors"
    >
      <p
        className={`mb-4 text-center text-[10px] font-bold uppercase tracking-[0.3em] ${
          isLogin ? "text-gray-500" : "text-gray-600"
        }`}
      >
        Proud sponsors
      </p>

      {/* Desktop / tablet: side by side */}
      <div className="mx-auto hidden max-w-4xl items-center justify-center gap-4 sm:flex md:gap-6">
        {SPONSORS.map((sponsor) => (
          <div
            key={sponsor.name}
            className={`flex flex-1 items-center justify-center rounded-lg px-4 py-3 ${sponsorTileClass(
              sponsor.lightBg,
              isLogin
            )}`}
          >
            <img
              src={sponsor.src}
              alt={`${sponsor.name} logo`}
              className="h-10 w-auto max-w-[220px] object-contain md:h-12"
            />
          </div>
        ))}
      </div>

      {/* Mobile: stacked, compact */}
      <div className="mx-auto flex max-w-xs flex-col gap-3 sm:hidden">
        {SPONSORS.map((sponsor) => (
          <div
            key={sponsor.name}
            className={`flex items-center justify-center rounded-lg px-3 py-2.5 ${sponsorTileClass(
              sponsor.lightBg,
              isLogin
            )}`}
          >
            <img
              src={sponsor.src}
              alt={`${sponsor.name} logo`}
              className="h-8 w-auto max-w-full object-contain"
            />
          </div>
        ))}
      </div>
    </aside>
  );
}
