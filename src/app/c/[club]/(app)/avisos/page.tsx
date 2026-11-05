import { Megaphone } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { AnnouncementComposer } from "@/features/announcements/composer";
import { AnnouncementItem, type AnnouncementItemData } from "@/features/announcements/announcement-item";
import { MarkSeen } from "@/features/announcements/mark-seen";
import { requireClub } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Avisos" };

export default async function AnnouncementsPage({ params }: PageProps<"/c/[club]/avisos">) {
  const { club: slug } = await params;
  const { club, isStaff, userId } = await requireClub(slug, "/avisos");
  const supabase = await createClient();

  const [{ data: rows }, { data: shifts }] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, body, image_path, pinned_at, published_at, profiles(full_name, avatar_path), shifts(name)")
      .eq("club_id", club.id)
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("published_at", { ascending: false })
      .limit(50),
    isStaff ? supabase.from("shifts").select("id, name").eq("club_id", club.id).is("archived_at", null).order("starts_at") : Promise.resolve({ data: [] }),
  ]);

  const ids = (rows ?? []).map((r) => r.id);
  const [{ data: stats }, signed] = await Promise.all([
    ids.length ? supabase.rpc("announcement_stats", { p_ids: ids }) : Promise.resolve({ data: [] }),
    (async () => {
      const paths = (rows ?? []).map((r) => r.image_path).filter((p): p is string => !!p);
      if (!paths.length) return new Map<string, string>();
      const { data } = await supabase.storage.from("club-files").createSignedUrls(paths, 60 * 60);
      return new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path!, d.signedUrl]));
    })(),
  ]);
  const statsBy = new Map((stats ?? []).map((s) => [s.announcement_id, s]));

  const items: AnnouncementItemData[] = (rows ?? []).map((r) => {
    const st = statsBy.get(r.id);
    return {
      id: r.id,
      body: r.body,
      imageUrl: r.image_path ? (signed.get(r.image_path) ?? null) : null,
      pinned: !!r.pinned_at,
      publishedAt: r.published_at,
      author: { name: r.profiles?.full_name || "Coach", avatar: r.profiles?.avatar_path ?? null },
      shiftName: r.shifts?.name ?? null,
      views: Number(st?.views ?? 0),
      reactions: (st?.reactions as Record<string, number>) ?? {},
      mine: st?.my_reactions ?? [],
    };
  });

  return (
    <div>
      <PageHeader title="Avisos" />
      {isStaff && <AnnouncementComposer clubId={club.id} userId={userId} shifts={shifts ?? []} />}
      {items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Sin avisos"
          description={isStaff ? "Publicá el primero: les llega como notificación con la marca del club." : "Cuando el coach publique algo, lo vas a ver acá."}
        />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <AnnouncementItem key={a.id} a={a} isStaff={isStaff} />
          ))}
        </div>
      )}
      <MarkSeen ids={ids} />
    </div>
  );
}
