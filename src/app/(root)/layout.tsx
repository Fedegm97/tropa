import Link from "next/link";
import { PlatformLogo } from "@/components/brand/platform-logo";
import { PLATFORM_NAME } from "@/lib/env";

export default function RootSiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col" style={{ "--accent": "#FF5A1F", "--accent-fg": "#0B0907", "--accent-text": "#FF7A47" } as React.CSSProperties}>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" aria-label={`${PLATFORM_NAME}, inicio`}>
          <PlatformLogo />
        </Link>
        <Link href="/ingresar" className="flex min-h-11 items-center px-2 text-sm font-medium text-muted hover:text-fg">
          Ingresar
        </Link>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12">{children}</main>
      <footer className="border-t border-border/60 py-6 text-center font-mono text-xs text-subtle">
        {PLATFORM_NAME} · Hecho para running teams
      </footer>
    </div>
  );
}
