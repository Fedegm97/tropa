import { Button } from "@/components/ui/button";
import { getPublicClub } from "@/lib/club";
import { ClubHero, PublicShell } from "../club-header";

export default async function NoAccessPage({ params }: PageProps<"/c/[club]/sin-acceso">) {
  const { club: slug } = await params;
  const club = (await getPublicClub(slug))!;
  return (
    <PublicShell>
      <ClubHero club={club} />
      <p className="text-center text-muted">
        Todavía no sos parte de este club. Pedile a tu coach el link de invitación y abrilo desde este celular.
      </p>
      <form action="/auth/salir" method="post" className="mt-6">
        <Button variant="outline" block>
          Ingresar con otra cuenta
        </Button>
      </form>
    </PublicShell>
  );
}
