import { ProgressSteps } from "@/components/ui/steps";
import { SessionBuilder } from "@/features/training/session-builder";
import { builderOptions } from "@/features/training/builder-data";
import { NextStepButton } from "@/features/onboarding/next-step-button";
import { requireStaff } from "@/lib/club";
import { addDays, todayIn } from "@/lib/domain/dates";

export const metadata = { title: "Tu primer plan" };

export default async function OnboardingFirstPlanPage({ params }: PageProps<"/c/[club]/onboarding/primer-plan">) {
  const { club: slug } = await params;
  const { club } = await requireStaff(slug, "/onboarding/primer-plan");
  const options = await builderOptions(club.id);
  return (
    <div className="space-y-5">
      <ProgressSteps step={3} label="Primer plan" />
      <div>
        <h1 className="font-display text-4xl font-extrabold uppercase leading-none">Tu primera sesión</h1>
        <p className="mt-2 text-muted">
          Elegí un modelo, ajustalo y publicalo. Cada corredor ve los ritmos calculados para él según su ritmo de referencia.
        </p>
      </div>
      <SessionBuilder {...options} initial={{ date: addDays(todayIn(club.timezone), 1) }} showPresets onDoneHref="/?bienvenida=1" />
      <NextStepButton step={4} href="/" variant="ghost">
        Lo hago después
      </NextStepButton>
    </div>
  );
}
