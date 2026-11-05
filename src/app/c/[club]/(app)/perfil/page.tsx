import Link from "next/link";
import { ArrowUpRight, LogOut, Smartphone } from "lucide-react";
import { ClubBadge } from "@/components/brand/club-badge";
import { Button } from "@/components/ui/button";
import { Badge, Card, SectionTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell/page-header";
import { PushToggle } from "@/components/pwa/push-toggle";
import { ProfileForm } from "@/features/members/profile-form";
import { loadProfileForm } from "@/features/members/profile-data";
import { LEVELS } from "@/features/members/schemas";
import { requireClub } from "@/lib/club";
import { ROOT_DOMAIN } from "@/lib/env";
import { clubOrigin } from "@/lib/hosts";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Perfil" };

export default async function ProfilePage({ params }: PageProps<"/c/[club]/perfil">) {
  const { club: slug } = await params;
  const ctx = await requireClub(slug, "/perfil");
  const { initial, avatarPath } = await loadProfileForm(ctx);
  const supabase = await createClient();
  const [{ data: shift }, { data: otherClubs }] = await Promise.all([
    ctx.membership.shift_id ? supabase.from("shifts").select("name, starts_at").eq("id", ctx.membership.shift_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase
      .from("memberships")
      .select("clubs(slug, name, primary_color, logo_path)")
      .eq("user_id", ctx.userId)
      .eq("status", "active")
      .neq("club_id", ctx.club.id),
  ]);

  return (
    <div>
      <PageHeader title="Tu perfil" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="accent">{ctx.membership.role === "runner" ? "Corredor" : ctx.membership.role === "coach" ? "Coach" : "Owner"}</Badge>
        {shift && <Badge>Turno {shift.name}</Badge>}
        {ctx.membership.level && <Badge>{LEVELS[ctx.membership.level]}</Badge>}
      </div>
      <ProfileForm userId={ctx.userId} initial={initial} avatarPath={avatarPath} />

      <SectionTitle className="mt-8">Notificaciones y app</SectionTitle>
      <Card className="space-y-3">
        <PushToggle clubId={ctx.club.id} />
        <Button asChild variant="outline" block>
          <Link href="/instalar">
            <Smartphone /> Cómo instalar la app
          </Link>
        </Button>
      </Card>

      {otherClubs && otherClubs.length > 0 && (
        <>
          <SectionTitle>Tus otros clubes</SectionTitle>
          <div className="space-y-2">
            {otherClubs.map((m) =>
              m.clubs ? (
                <a key={m.clubs.slug} href={clubOrigin(m.clubs.slug, ROOT_DOMAIN)}>
                  <Card className="flex items-center gap-3 p-3 hover:bg-surface-2">
                    <ClubBadge name={m.clubs.name} color={m.clubs.primary_color} logoPath={m.clubs.logo_path} size={32} />
                    <span className="flex-1">{m.clubs.name}</span>
                    <ArrowUpRight className="size-4 text-subtle" />
                  </Card>
                </a>
              ) : null,
            )}
          </div>
        </>
      )}

      <form action="/auth/salir" method="post" className="mt-8">
        <Button variant="ghost" block>
          <LogOut /> Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
