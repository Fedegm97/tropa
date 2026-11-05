import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ClubNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-7xl font-extrabold text-accent-text">404</p>
      <h1 className="mt-2 font-display text-2xl font-bold uppercase">No encontramos esta página</h1>
      <Button asChild className="mt-6">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
