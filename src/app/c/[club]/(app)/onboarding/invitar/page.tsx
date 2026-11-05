import { ProgressSteps } from "@/components/ui/steps";
import { InviteBlock } from "@/features/onboarding/invite-block";
import { NextStepButton } from "@/features/onboarding/next-step-button";
import { currentOrigin, requireStaff } from "@/lib/club";

export const metadata = { title: "Invitá a tus corredores" };

export default async function OnboardingInvitePage({ params }: PageProps<"/c/[club]/onboarding/invitar">) {
  const { club: slug } = await params;
  const { club } = await requireStaff(slug, "/onboarding/invitar");
  const origin = await currentOrigin();
  return (
    <div className="space-y-5">
      <ProgressSteps step={2} label="Invitá corredores" />
      <div>
        <h1 className="font-display text-4xl font-extrabold uppercase leading-none">¡Tu app está lista! 🎉</h1>
        <p className="mt-2 text-muted">Ahora sumá a tus corredores. Mandales el link por el grupo de WhatsApp del club.</p>
      </div>
      <InviteBlock clubName={club.name} origin={origin} initialCode={club.invite_code} canRegenerate={false} />
      <NextStepButton step={3} href="/onboarding/primer-plan">
        Siguiente: crear el primer plan
      </NextStepButton>
    </div>
  );
}
