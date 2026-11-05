import Link from "next/link";
import { BellRing, CalendarCheck, Palette, Smartphone, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PhonePreview } from "@/features/clubs/phone-preview";
import { ROOT_DOMAIN } from "@/lib/env";

const FEATURES = [
  { icon: Palette, title: "Tu marca", text: "Nombre, color, logo y subdominio propio. Tus corredores sienten que es la app del club." },
  { icon: Smartphone, title: "Sin stores", text: "Se instala desde el navegador en iPhone y Android, en 10 segundos." },
  { icon: CalendarCheck, title: "Planes con ritmos", text: "Un mismo plan, un ritmo distinto para cada corredor según su nivel." },
  { icon: BellRing, title: "Avisos con push", text: "Notificaciones con el nombre y el logo de tu club. Chau grupo de WhatsApp." },
  { icon: Users, title: "Turnos", text: "Organizá grupos por horario y segmentá planes y avisos." },
  { icon: Wallet, title: "Cuotas y aptos", text: "Quién está al día y quién tiene el apto vencido, de un vistazo. (Pronto)" },
];

export default function LandingPage() {
  return (
    <>
      <section className="grid items-center gap-10 py-10 md:grid-cols-[1fr_300px] md:py-16">
        <div>
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-accent-text">Para coaches y running teams</p>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.95] md:text-7xl">
            La app de tu club,
            <br />
            con tu marca.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted">
            Planes, avisos, turnos y más en un solo lugar. Reemplazá el WhatsApp, el Excel y las transferencias sueltas. Lista en menos de 2 minutos.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/crear">Crear mi club gratis</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/ingresar">Ya tengo cuenta</Link>
            </Button>
          </div>
          <p className="mt-4 font-mono text-xs text-subtle">Gratis hasta 10 corredores · Sin tarjeta</p>
        </div>
        <PhonePreview name="Río Norte Running Team" color="#FF5A1F" slug="rionorte" rootDomain={ROOT_DOMAIN} />
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <Card key={title}>
            <Icon className="mb-3 size-6 text-accent-text" aria-hidden />
            <h2 className="font-display text-xl font-bold uppercase">{title}</h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </Card>
        ))}
      </section>
    </>
  );
}
