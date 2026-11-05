import { PoweredBy } from "@/components/brand/powered-by";
import { LoginForm } from "@/features/auth/login-form";
import { JoinButton } from "@/features/onboarding/join-button";
import { getUser } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";
import { ClubHero, PublicShell } from "../../club-header";

export const metadata = { title: "Unite al club" };

export default async function JoinPage({ params }: PageProps<"/c/[club]/unirme/[code]">) {
  const { club: slug, code } = await params;
  const supabase = await createClient();
  const { data: club } = await supabase.rpc("club_public_by_invite", { p_code: code }).maybeSingle();

  if (!club || club.slug !== slug) {
    return (
      <PublicShell>
        <h1 className="font-display text-3xl font-extrabold uppercase">Link inválido</h1>
        <p className="mt-2 text-muted">El link de invitación no existe o fue regenerado. Pedile uno nuevo a tu coach.</p>
      </PublicShell>
    );
  }

  const user = await getUser();
  return (
    <PublicShell>
      <ClubHero club={club} subtitle={`Te invitaron a sumarte a ${club.name}`} />
      {user ? (
        <JoinButton code={code} clubName={club.name} />
      ) : (
        <>
          <p className="mb-4 text-center text-sm text-muted">Creá tu cuenta o ingresá. Es gratis y tarda un minuto.</p>
          <LoginForm next={`/unirme/${code}`} cta="Sumarme con mi email" />
        </>
      )}
      <PoweredBy />
    </PublicShell>
  );
}
