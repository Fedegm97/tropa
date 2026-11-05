import Link from "next/link";
import { Avatar } from "@/components/brand/club-badge";
import { Badge, Card } from "@/components/ui/card";
import { LockedFeature } from "@/components/ui/locked-feature";
import { PageHeader } from "@/components/shell/page-header";
import { MEDICAL_TONE } from "@/features/medical/labels";
import { signedUrls } from "@/features/fees/data";
import { clubHas, requireStaff } from "@/lib/club";
import { MEDICAL_STATUS_LABEL, type MedicalStatus } from "@/lib/domain/medical";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Aptos médicos" };

const ORDER: MedicalStatus[] = ["expired", "expiring", "missing", "valid"];

export default async function MedicalOverviewPage({ params, searchParams }: PageProps<"/c/[club]/aptos">) {
  const [{ club: slug }, sp] = await Promise.all([params, searchParams]);
  const { club } = await requireStaff(slug, "/aptos");
  if (!clubHas(club, "medical")) {
    return (
      <div>
        <PageHeader title="Aptos médicos" back="/" />
        <LockedFeature feature="medical" title="Apto médico" isStaff />
      </div>
    );
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("club_medical_statuses", { p_club: club.id });
  const rows = (data ?? []).map((r) => ({ ...r, status: r.status as MedicalStatus }));
  const filter = ORDER.find((s) => s === sp.estado) ?? null;
  const visible = (filter ? rows.filter((r) => r.status === filter) : rows).sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const urls = await signedUrls(visible.map((r) => r.file_path));
  const count = (s: MedicalStatus) => rows.filter((r) => r.status === s).length;

  return (
    <div>
      <PageHeader title="Aptos médicos" back="/" subtitle={`${count("valid")} de ${rows.length} vigentes`} />
      <div className="mb-4 flex flex-wrap gap-2">
        {([null, ...ORDER] as (MedicalStatus | null)[]).map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/aptos?estado=${s}` : "/aptos"}
            className={cn("flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium", filter === s ? "border-accent bg-accent/15" : "border-border text-muted")}
          >
            {s ? MEDICAL_STATUS_LABEL[s] : "Todos"} <span className="font-mono text-xs text-subtle">{s ? count(s) : rows.length}</span>
          </Link>
        ))}
      </div>
      <div className="space-y-2">
        {visible.map((r) => (
          <Card key={r.user_id} className="flex items-center gap-3 p-3">
            <Avatar name={r.full_name} path={r.avatar_path} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.full_name}</p>
              <p className="font-mono text-xs text-muted">
                {r.expires_on ? `vence ${r.expires_on.split("-").reverse().join("/")}` : "sin cargar"}
                {r.file_path && urls.get(r.file_path) && (
                  <>
                    {" · "}
                    <a href={urls.get(r.file_path)} target="_blank" rel="noopener noreferrer" className="underline">
                      ver
                    </a>
                  </>
                )}
              </p>
            </div>
            <Badge tone={MEDICAL_TONE[r.status]}>{MEDICAL_STATUS_LABEL[r.status]}</Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
