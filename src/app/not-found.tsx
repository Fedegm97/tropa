import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-7xl font-extrabold text-[#FF7A47]">404</p>
      <h1 className="mt-2 font-display text-2xl font-bold uppercase">Esta página no existe</h1>
      <p className="mt-2 text-muted">Si buscabas la app de tu club, revisá la dirección que te pasó tu coach.</p>
      <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-2xl bg-surface-2 px-5 font-semibold">
        Ir al inicio
      </Link>
    </main>
  );
}
