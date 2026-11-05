"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { sendMagicLink, signInWithPassword } from "./actions";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

export function LoginForm({ next = "/", cta = "Mandame el link" }: { next?: string; cta?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    start(async () => {
      if (usePassword) {
        const res = await signInWithPassword({ email, password });
        if (!res.ok) return setError(res.error);
        router.replace(next);
        router.refresh();
        return;
      }
      const res = await sendMagicLink({ email, next });
      if (!res.ok) return setError(res.error);
      setSentTo(email);
    });
  }

  async function google() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) toast.error("No pudimos conectar con Google.");
  }

  if (sentTo) {
    return (
      <div className="rounded-card border border-border bg-surface p-6 text-center">
        <MailCheck className="mx-auto mb-3 size-10 text-accent-text" aria-hidden />
        <h2 className="font-display text-2xl font-bold uppercase">Revisá tu mail</h2>
        <p className="mt-2 text-sm text-muted">
          Te mandamos un link a <span className="font-medium text-fg">{sentTo}</span>. Abrilo desde este mismo celular para entrar.
        </p>
        <Button variant="ghost" className="mt-4" onClick={() => setSentTo(null)}>
          Usar otro email
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="secondary" block size="lg" onClick={google} type="button">
        <GoogleIcon /> Seguir con Google
      </Button>
      <div className="flex items-center gap-3 font-mono text-xs uppercase text-subtle">
        <span className="h-px flex-1 bg-border" /> o con tu email <span className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={error}>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="vos@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error}
            required
          />
        </Field>
        {usePassword && (
          <Field label="Contraseña" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
        )}
        <Button type="submit" block size="lg" loading={pending}>
          {usePassword ? "Ingresar" : cta}
        </Button>
      </form>
      <button
        type="button"
        onClick={() => setUsePassword((v) => !v)}
        className="mx-auto block min-h-11 text-sm text-subtle underline-offset-4 hover:underline"
      >
        {usePassword ? "Prefiero un link por mail" : "Tengo contraseña"}
      </button>
    </div>
  );
}
