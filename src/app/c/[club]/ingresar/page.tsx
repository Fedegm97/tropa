import { redirect } from "next/navigation";
import { PoweredBy } from "@/components/brand/powered-by";
import { LoginForm } from "@/features/auth/login-form";
import { getPublicClub, getUser } from "@/lib/club";
import { safeNext } from "@/lib/hosts";
import { ClubHero, PublicShell } from "../club-header";

export const metadata = { title: "Ingresar" };

export default async function ClubLoginPage({ params, searchParams }: PageProps<"/c/[club]/ingresar">) {
  const [{ club: slug }, sp] = await Promise.all([params, searchParams]);
  const club = (await getPublicClub(slug))!;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined);
  if (await getUser()) redirect(next);

  return (
    <PublicShell>
      <ClubHero club={club} subtitle="Ingresá para ver tu plan" />
      {sp.error && <p className="mb-4 rounded-2xl bg-danger/15 p-3 text-sm text-danger">El link venció o ya se usó. Pedí uno nuevo.</p>}
      <LoginForm next={next} />
      <PoweredBy />
    </PublicShell>
  );
}
