"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptStaffInvitation } from "@/features/clubs/actions";

export function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      block
      size="lg"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await acceptStaffInvitation(token);
          if (!res.ok) return void toast.error(res.error);
          toast.success("¡Ya sos coach del club!");
          router.replace("/");
          router.refresh();
        })
      }
    >
      Aceptar invitación
    </Button>
  );
}
