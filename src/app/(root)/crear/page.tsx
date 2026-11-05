import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ClubBadge } from "@/components/brand/club-badge";
import { Card } from "@/components/ui/card";
import { CreateClubForm } from "@/features/clubs/create-club-form";
import { getUser } from "@/lib/club";
import { ROOT_DOMAIN } from "@/lib/env";
import { clubOrigin } from "@/lib/hosts";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Crear club" };

export default async function CreateClubPage() {
  const user = await getUser();
  if (!user) redirect("/ingresar?next=/crear");

  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("memberships")
    .select("role, clubs(slug, name, primary_color, logo_path)")
    .eq("user_id", user.id)
    .eq("status", "active");

  return (
    <div className="py-6">
      {memberships && memberships.length > 0 && (
        <div className="mb-8">
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-subtle">Tus clubes</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {memberships.map((m) =>
              m.clubs ? (
                <a key={m.clubs.slug} href={clubOrigin(m.clubs.slug, ROOT_DOMAIN)}>
                  <Card className="flex items-center gap-3 hover:bg-surface-2">
                    <ClubBadge name={m.clubs.name} color={m.clubs.primary_color} logoPath={m.clubs.logo_path} />
                    <span className="flex-1 truncate font-semibold">{m.clubs.name}</span>
                    <ArrowRight className="size-4 text-subtle" aria-hidden />
                  </Card>
                </a>
              ) : null,
            )}
          </div>
        </div>
      )}
      <CreateClubForm rootDomain={ROOT_DOMAIN} />
      <p className="mt-8 text-center text-sm text-subtle">
        ¿Te invitaron a un club? Abrí el link que te pasó tu coach. <Link href="/" className="underline">Volver</Link>
      </p>
    </div>
  );
}
