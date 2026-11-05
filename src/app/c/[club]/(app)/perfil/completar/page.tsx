import { PageHeader } from "@/components/shell/page-header";
import { ProfileForm } from "@/features/members/profile-form";
import { loadProfileForm } from "@/features/members/profile-data";
import { requireClub } from "@/lib/club";

export const metadata = { title: "Completá tu perfil" };

export default async function CompleteProfilePage({ params }: PageProps<"/c/[club]/perfil/completar">) {
  const { club: slug } = await params;
  const ctx = await requireClub(slug, "/perfil/completar");
  const { initial, avatarPath } = await loadProfileForm(ctx);
  return (
    <div>
      <PageHeader title="Completá tu perfil" subtitle={`Así ${ctx.club.name} te conoce mejor. Tarda un minuto.`} />
      <ProfileForm userId={ctx.userId} initial={initial} avatarPath={avatarPath} complete doneHref="/instalar" />
    </div>
  );
}
