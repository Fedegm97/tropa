import { CoachHome } from "@/features/home/coach-home";
import { RunnerHome } from "@/features/home/runner-home";
import { requireClub } from "@/lib/club";

export default async function HomePage({ params }: PageProps<"/c/[club]">) {
  const { club } = await params;
  const ctx = await requireClub(club);
  return ctx.isStaff ? <CoachHome ctx={ctx} /> : <RunnerHome ctx={ctx} />;
}
