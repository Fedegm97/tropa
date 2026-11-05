"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Megaphone, Settings, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const RUNNER = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/avisos", label: "Avisos", icon: Megaphone },
  { href: "/perfil", label: "Perfil", icon: User },
];

const STAFF = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/plan", label: "Planes", icon: CalendarDays },
  { href: "/corredores", label: "Corredores", icon: Users },
  { href: "/avisos", label: "Avisos", icon: Megaphone },
  { href: "/ajustes", label: "Club", icon: Settings },
];

export function BottomNav({ isStaff, slug, unread }: { isStaff: boolean; slug: string; unread: number }) {
  const raw = usePathname() ?? "/";
  // Si el pathname llega reescrito (/c/{slug}/…), lo normalizamos.
  const pathname = raw.startsWith(`/c/${slug}`) ? raw.slice(`/c/${slug}`.length) || "/" : raw;
  const items = isStaff ? STAFF : RUNNER;
  return (
    <nav aria-label="Navegación principal" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-bg/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-accent-text" : "text-subtle")}
              >
                <Icon className="size-[22px]" aria-hidden strokeWidth={active ? 2.4 : 2} />
                {label}
                {href === "/avisos" && unread > 0 && (
                  <span className="absolute right-[calc(50%-20px)] top-2 grid min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[10px] text-accent-fg">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
