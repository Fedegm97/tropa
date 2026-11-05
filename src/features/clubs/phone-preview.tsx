import { CalendarDays, Home, Megaphone, User } from "lucide-react";
import { ClubBadge } from "@/components/brand/club-badge";
import { accentForDarkBg, readableOn } from "@/lib/domain/color";
import { PLATFORM_NAME } from "@/lib/env";

/** Vista previa de la app del club que se actualiza en vivo durante el alta. */
export function PhonePreview({ name, color, logoUrl, slug, rootDomain }: { name: string; color: string; logoUrl?: string | null; slug: string; rootDomain: string }) {
  const display = name.trim() || "Tu club";
  const accentText = accentForDarkBg(color);
  const days = ["L", "M", "M", "J", "V", "S", "D"];
  const done = [1, 1, 0, 1, 0, 0, 0];
  return (
    <div className="mx-auto w-[260px] rounded-[2.4rem] border-[6px] border-[#2a231e] bg-[#15110e] p-3 shadow-2xl shadow-black/50" aria-label="Vista previa de la app">
      <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-[#2a231e]" />
      <p className="mb-2 truncate text-center font-mono text-[9px] text-subtle">{(slug || "tuclub") + "." + rootDomain.split(":")[0]}</p>
      <div className="mb-3 flex items-center gap-2">
        <ClubBadge name={display} color={color} logoUrl={logoUrl} size={30} />
        <span className="truncate font-display text-base font-bold uppercase">{display}</span>
      </div>
      <div className="mb-2 rounded-2xl bg-surface p-3">
        <p className="font-mono text-[9px] uppercase tracking-widest text-subtle">Plan de hoy</p>
        <p className="mt-1 font-display text-lg font-bold uppercase leading-tight">Pasadas 6×1000</p>
        <p className="font-mono text-[10px]" style={{ color: accentText }}>
          4:20–4:28 /km
        </p>
        <span className="mt-2 inline-block rounded-xl px-3 py-1.5 text-[10px] font-semibold" style={{ background: color, color: readableOn(color) }}>
          Marcar como hecho
        </span>
      </div>
      <div className="mb-3 rounded-2xl bg-surface p-3">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-subtle">Tu semana</p>
        <div className="flex items-end justify-between gap-1">
          {days.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="h-8 w-full rounded-md" style={{ background: done[i] ? color : "#2a231e" }} />
              <span className="font-mono text-[8px] text-subtle">{d}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-around rounded-2xl bg-surface py-2">
        {[Home, CalendarDays, Megaphone, User].map((Icon, i) => (
          <Icon key={i} className="size-4" style={{ color: i === 0 ? accentText : "#8a7d72" }} aria-hidden />
        ))}
      </div>
      <p className="mt-2 text-center font-mono text-[8px] text-subtle">con tecnología de {PLATFORM_NAME}</p>
    </div>
  );
}
