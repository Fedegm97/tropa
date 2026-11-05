"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteSession, deleteTemplate, duplicateWeek, publishSession } from "./actions";

export function DuplicateWeekButton({ date }: { date: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await duplicateWeek(date);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.refresh();
        })
      }
    >
      <Copy /> Duplicar semana
    </Button>
  );
}

export function SessionStaffActions({ id, published }: { id: string; published: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2">
      {!published && (
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await publishSession(id);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              router.refresh();
            })
          }
        >
          <Send /> Publicar y avisar
        </Button>
      )}
      <Button
        variant="danger"
        loading={pending}
        onClick={() => {
          if (!confirm("¿Eliminar esta sesión? También se borran las completadas.")) return;
          start(async () => {
            const res = await deleteSession(id);
            if (!res.ok) return void toast.error(res.error);
            toast.success(res.message);
            router.replace("/plan");
          });
        }}
      >
        <Trash2 /> Eliminar
      </Button>
    </div>
  );
}

export function DeleteTemplateButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Eliminar plantilla"
      loading={pending}
      onClick={() => {
        if (!confirm("¿Eliminar esta plantilla?")) return;
        start(async () => {
          const res = await deleteTemplate(id);
          if (!res.ok) return void toast.error(res.error);
          router.refresh();
        });
      }}
    >
      {!pending && <Trash2 />}
    </Button>
  );
}
