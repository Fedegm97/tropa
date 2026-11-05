import { PoweredBy } from "@/components/brand/powered-by";
import { LoginForm } from "@/features/auth/login-form";
import { AcceptInvitationButton } from "@/features/onboarding/accept-invitation-button";
import { getUser } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";
import { ClubHero, PublicShell } from "../../club-header";

export const metadata = { title: "Invitación de coach" };

export default async function StaffInvitationPage({ params }: PageProps<"/c/[club]/invitacion/[token]">) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: inv } = await supabase.rpc("staff_invitation_preview", { p_token: token }).maybeSingle();

  if (!inv || inv.expired) {
    return (
      <PublicShell>
        <h1 className="font-display text-3xl font-extrabold uppercase">Invitación vencida</h1>
        <p className="mt-2 text-muted">Esta invitación ya se usó o venció. Pedile al owner del club que te mande otra.</p>
      </PublicShell>
    );
  }

  const user = await getUser();
  const club = { name: inv.club_name, primary_color: inv.primary_color, logo_path: null };
  return (
    <PublicShell>
      <ClubHero club={club} subtitle={`Te invitaron a ser coach de ${inv.club_name}`} />
      {user ? (
        user.email?.toLowerCase() === inv.email ? (
          <AcceptInvitationButton token={token} />
        ) : (
          <p className="rounded-2xl bg-warning/15 p-4 text-sm text-warning">
            Esta invitación es para <b>{inv.email}</b>. Cerrá sesión e ingresá con ese email.
          </p>
        )
      ) : (
        <LoginForm next={`/invitacion/${token}`} />
      )}
      <PoweredBy />
    </PublicShell>
  );
}
