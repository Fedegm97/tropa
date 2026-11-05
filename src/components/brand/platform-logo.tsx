import { PLATFORM_NAME } from "@/lib/env";

export function PlatformLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-2xl font-extrabold uppercase tracking-wide ${className}`}>
      <span className="grid size-8 place-items-center rounded-lg bg-[#FF5A1F] text-base text-[#0B0907]">▲</span>
      {PLATFORM_NAME}
    </span>
  );
}
