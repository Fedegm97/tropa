import { ClubBadge } from "@/components/brand/club-badge";

export function ClubHero({ club, subtitle }: { club: { name: string; primary_color: string; logo_path: string | null }; subtitle?: string }) {
  return (
    <div className="mb-8 flex flex-col items-center text-center">
      <ClubBadge name={club.name} color={club.primary_color} logoPath={club.logo_path} size={84} className="mb-4 shadow-lg shadow-black/40" />
      <h1 className="font-display text-4xl font-extrabold uppercase leading-none">{club.name}</h1>
      {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
    </div>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">{children}</main>;
}
