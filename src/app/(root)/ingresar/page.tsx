import { LoginForm } from "@/features/auth/login-form";
import { safeNext } from "@/lib/hosts";

export const metadata = { title: "Ingresar" };

export default async function RootLoginPage({ searchParams }: PageProps<"/ingresar">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined, "/crear");
  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="font-display text-4xl font-extrabold uppercase">Ingresá</h1>
      <p className="mb-6 mt-1 text-muted">Te mandamos un link por mail, sin contraseñas.</p>
      {sp.error && <p className="mb-4 rounded-2xl bg-danger/15 p-3 text-sm text-danger">El link venció o ya se usó. Pedí uno nuevo.</p>}
      <LoginForm next={next} />
    </div>
  );
}
