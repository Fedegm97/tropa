import { notFound } from "next/navigation";
import { Phone, Siren } from "lucide-react";
import { Avatar } from "@/components/brand/club-badge";
import { Badge, Card, SectionTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell/page-header";
import { RunnerAdminForm } from "@/features/members/runner-admin-form";
import { requireStaff } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";

function age(birth: string | null) {
  if (!birth) return null;
  const b = new Date(birth);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) a--;
  return a;
}

export default async function RunnerDetailPage({ params }: PageProps<"/c/[club]/corredores/[userId]">) {
  const { club: slug, userId } = await params;
  const { club, isOwner, userId: me } = await requireStaff(slug);
  const supabase = await createClient();
  const [{ data: m }, { data: priv }, { data: shifts }, { data: recent }] = await Promise.all([
    supabase
      .from("memberships")
      .select("*, profiles(full_name, avatar_path)")
      .eq("club_id", club.id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
    supabase.from("profile_private").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("shifts").select("id, name").eq("club_id", club.id).is("archived_at", null).order("starts_at"),
    supabase
      .from("session_completions")
      .select("feeling, comment, completed_at, training_sessions(title, date)")
      .eq("club_id", club.id)
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(8),
  ]);
  if (!m) notFound();
  const name = m.profiles?.full_name || "Sin nombre";
  const years = age(priv?.birth_date ?? null);

  return (
    <div>
      <PageHeader title="Corredor" back="/corredores" />
      <div className="mb-4 flex items-center gap-4">
        <Avatar name={name} path={m.profiles?.avatar_path} size={64} />
        <div>
          <p className="font-display text-3xl font-bold uppercase leading-none">{name}</p>
          <div className="mt-1 flex gap-2">
            {m.role !== "runner" && <Badge tone="accent">{m.role}</Badge>}
            {years !== null && <Badge>{years} años</Badge>}
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-2">
        {priv?.phone && (
          <a href={`tel:${priv.phone}`}>
            <Card className="flex items-center gap-3 p-3 hover:bg-surface-2">
              <Phone className="size-5 text-accent-text" aria-hidden />
              <span className="font-mono">{priv.phone}</span>
            </Card>
          </a>
        )}
        {(priv?.emergency_name || priv?.emergency_phone) && (
          <a href={priv?.emergency_phone ? `tel:${priv.emergency_phone}` : undefined}>
            <Card className="flex items-center gap-3 p-3 hover:bg-surface-2">
              <Siren className="size-5 text-danger" aria-hidden />
              <span className="text-sm">
                Emergencia: <b>{priv?.emergency_name}</b> <span className="font-mono">{priv?.emergency_phone}</span>
              </span>
            </Card>
          </a>
        )}
      </div>

      <RunnerAdminForm
        userId={userId}
        role={m.role}
        shiftId={m.shift_id}
        level={m.level}
        pace={m.ref_pace_s_per_km}
        paceKind={m.ref_pace_kind}
        shifts={shifts ?? []}
        canManageRoles={isOwner}
        isSelf={userId === me}
      />

      <SectionTitle className="mt-6">Últimas sesiones</SectionTitle>
      {recent && recent.length > 0 ? (
        <div className="space-y-2">
          {recent.map((r, i) => (
            <Card key={i} className="p-3">
              <p className="text-sm">
                <b>{r.training_sessions?.title}</b> <span className="font-mono text-xs text-subtle">{r.training_sessions?.date}</span>{" "}
                {r.feeling ? ["", "😫", "😓", "🙂", "😄", "🚀"][r.feeling] : ""}
              </p>
              {r.comment && <p className="text-sm text-muted">“{r.comment}”</p>}
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-subtle">Todavía no completó sesiones.</p>
      )}
    </div>
  );
}
