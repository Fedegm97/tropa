import Link from "next/link";
import { PoweredBy } from "@/components/brand/powered-by";
import { Button } from "@/components/ui/button";
import { InstallGuide } from "@/components/pwa/install-guide";
import { getPublicClub } from "@/lib/club";
import { ClubHero, PublicShell } from "../club-header";

export const metadata = { title: "Instalá la app" };

export default async function InstallPage({ params }: PageProps<"/c/[club]/instalar">) {
  const { club: slug } = await params;
  const club = (await getPublicClub(slug))!;
  return (
    <PublicShell>
      <ClubHero club={club} subtitle="Instalá la app en tu celular. Sin Play Store ni App Store." />
      <InstallGuide clubName={club.name} />
      <Button asChild variant="ghost" block className="mt-4">
        <Link href="/">Seguir en el navegador</Link>
      </Button>
      <PoweredBy />
    </PublicShell>
  );
}
