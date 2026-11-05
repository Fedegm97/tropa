import { HeartPulse } from "lucide-react";
import { Badge, Card, SectionTitle } from "@/components/ui/card";
import { LockedFeature } from "@/components/ui/locked-feature";
import { PageHeader } from "@/components/shell/page-header";
import { CertificateUploadForm } from "@/features/medical/upload-form";
import { MEDICAL_TONE } from "@/features/medical/labels";
import { signedUrls } from "@/features/fees/data";
import { clubHas, requireClub } from "@/lib/club";
import { todayIn } from "@/lib/domain/dates";
import { MEDICAL_STATUS_LABEL, daysUntil, medicalStatus } from "@/lib/domain/medical";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Apto médico" };

const fmt = (d: string) => d.split("-").reverse().join("/");

export default async function MyMedicalPage({ params }: PageProps<"/c/[club]/apto">) {
  const { club: slug } = await params;
  const { club, userId, isStaff } = await requireClub(slug, "/apto");
  const today = todayIn(club.timezone);
  const supabase = await createClient();
  const { data: certs } = await supabase
    .from("medical_certificates")
    .select("*")
    .eq("club_id", club.id)
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false })
    .limit(10);
  const enabled = clubHas(club, "medical");
  const last = certs?.[0];
  const status = medicalStatus(last?.expires_on, today);
  const urls = await signedUrls((certs ?? []).map((c) => c.file_path));

  if (!enabled && !last) {
    return (
      <div>
        <PageHeader title="Apto médico" back="/" />
        <LockedFeature feature="medical" title="Apto médico" isStaff={isStaff} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Apto médico" back="/" />
      <Card className={status === "valid" ? "border-success/40" : status === "missing" ? "" : status === "expiring" ? "border-warning/40" : "border-danger/40"}>
        <div className="flex items-center gap-3">
          <HeartPulse className="size-9 text-accent-text" aria-hidden />
          <div>
            <p className="font-display text-3xl font-extrabold uppercase leading-none">{MEDICAL_STATUS_LABEL[status]}</p>
            <p className="mt-1 text-sm text-muted">
              {!last
                ? "Todavía no cargaste tu apto médico."
                : status === "expired"
                  ? `Venció el ${fmt(last.expires_on)}. Cargá el nuevo.`
                  : `Vence el ${fmt(last.expires_on)}${status === "expiring" ? ` (en ${daysUntil(last.expires_on, today)} días)` : ""}.`}
            </p>
          </div>
        </div>
      </Card>

      {enabled && status !== "valid" && (
        <div className="mt-4">
          <CertificateUploadForm clubId={club.id} userId={userId} today={today} />
        </div>
      )}

      {(certs ?? []).length > 0 && (
        <>
          <SectionTitle className="mt-6">Historial</SectionTitle>
          <div className="space-y-2">
            {certs!.map((c) => (
              <Card key={c.id} className="flex items-center gap-3 p-3">
                <div className="flex-1">
                  <p className="text-sm">Vence el {fmt(c.expires_on)}</p>
                  <p className="font-mono text-xs text-subtle">cargado el {new Date(c.uploaded_at).toLocaleDateString("es-AR")}</p>
                </div>
                {urls.get(c.file_path) ? (
                  <a href={urls.get(c.file_path)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center text-sm text-accent-text underline">
                    Ver
                  </a>
                ) : (
                  <Badge tone={MEDICAL_TONE[medicalStatus(c.expires_on, today)]}>{MEDICAL_STATUS_LABEL[medicalStatus(c.expires_on, today)]}</Badge>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
      {enabled && status === "valid" && (
        <details className="mt-6">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted">¿Renovaste antes? Cargá el nuevo</summary>
          <div className="mt-2">
            <CertificateUploadForm clubId={club.id} userId={userId} today={today} />
          </div>
        </details>
      )}
    </div>
  );
}
