/* eslint-disable @next/next/no-img-element */

interface WorldCupLogoProps {
  className?: string;
}

export function WorldCupLogo({
  className = "h-8 w-auto object-contain",
}: WorldCupLogoProps) {
  return (
    <img
      src="/fifa-world-cup-trophy.png"
      alt="FIFA World Cup"
      className={className}
    />
  );
}
