"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { joinClub } from "@/features/clubs/actions";

export function JoinButton({ code, clubName }: { code: string; clubName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      block
      size="lg"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await joinClub(code);
          if (!res.ok) return void toast.error(res.error);
          toast.success(`¡Bienvenido a ${clubName}!`);
          router.replace("/perfil/completar");
          router.refresh();
        })
      }
    >
      Sumarme a {clubName}
    </Button>
  );
}
