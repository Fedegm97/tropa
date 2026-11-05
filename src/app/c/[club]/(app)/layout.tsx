import Link from "next/link";
import { Avatar, ClubBadge } from "@/components/brand/club-badge";
import { PoweredBy } from "@/components/brand/powered-by";
import { BottomNav } from "@/components/shell/bottom-nav";
import { getProfile, requireClub } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children, params }: LayoutProps<"/c/[club]">) {
  const { club: slug } = await params;
  const { club, isStaff, userId } = await requireClub(slug);
  const profile = await getProfile();
  const supabase = await createClient();
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("club_id", club.id)
    .eq("user_id", userId)
    .eq("kind", "announcement")
    .is("read_at", null);

  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-bg/90 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5">
          <ClubBadge name={club.name} color={club.primary_color} logoPath={club.logo_path} size={34} />
          <span className="truncate font-display text-xl font-bold uppercase">{club.name}</span>
        </Link>
        <Link href="/perfil" aria-label="Mi perfil" className="rounded-full">
          <Avatar name={profile?.full_name || "Yo"} path={profile?.avatar_path} size={34} />
        </Link>
      </header>
      <main className="px-4 pt-2">{children}</main>
      <PoweredBy />
      <BottomNav isStaff={isStaff} slug={slug} unread={unread ?? 0} />
    </div>
  );
}
