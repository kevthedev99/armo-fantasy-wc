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
  {
    name: "Notary Shiraz",
    src: "/sponsors/notary-shiraz.png",
    lightBg: false,
  },
  {
    name: "Black Crest Capital Group",
    src: "/sponsors/black-crest-capital-group.png",
    lightBg: false,
  },
  {
    name: "Mission Liquor",
    src: "/sponsors/mission-liquor.png",
    lightBg: true,
  },
  {
    name: "Encore Realty",
    src: "/sponsors/encore-realty.png",
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

      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 lg:gap-4">
        {SPONSORS.map((sponsor) => (
          <div
            key={sponsor.name}
            className={`flex items-center justify-center rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 ${sponsorTileClass(
              sponsor.lightBg,
              isLogin
            )}`}
          >
            <img
              src={sponsor.src}
              alt={`${sponsor.name} logo`}
              className="h-8 w-auto max-w-full object-contain sm:h-10 md:h-12"
            />
          </div>
        ))}
      </div>
    </aside>
  );
}
