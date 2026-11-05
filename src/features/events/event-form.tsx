"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { EVENT_KINDS, type EventKind } from "@/lib/domain/events";
import { deleteEvent, saveEvent, type EventInput } from "./actions";

export function EventForm({ initial }: { initial: EventInput }) {
  const router = useRouter();
  const [v, setV] = useState<EventInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof EventInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <Field label="Nombre" htmlFor="name" error={errors.name}>
        <Input id="name" value={v.name} onChange={set("name")} placeholder="10K de Palermo" maxLength={100} />
      </Field>
      <Field label="Tipo" htmlFor="kind">
        <Select id="kind" value={v.kind} onChange={set("kind")}>
          {(Object.keys(EVENT_KINDS) as EventKind[]).map((k) => (
            <option key={k} value={k}>
              {EVENT_KINDS[k].emoji} {EVENT_KINDS[k].label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha" htmlFor="date" error={errors.date}>
          <Input id="date" type="date" value={v.date} onChange={set("date")} className="font-mono" />
        </Field>
        <Field label="Hora" htmlFor="time" error={errors.time}>
          <Input id="time" type="time" value={v.time} onChange={set("time")} className="font-mono" />
        </Field>
      </div>
      <Field label="Lugar" htmlFor="location">
        <Input id="location" value={v.location ?? ""} onChange={set("location")} maxLength={160} />
      </Field>
      <Field label="Distancias" htmlFor="distances" hint="Separadas por coma. Ej.: 5K, 10K, 21K. Vacío si no aplica.">
        <Input id="distances" value={v.distances ?? ""} onChange={set("distances")} className="font-mono" />
      </Field>
      <Field label="Link de inscripción oficial" htmlFor="url" error={errors.registrationUrl}>
        <Input id="url" type="url" inputMode="url" value={v.registrationUrl ?? ""} onChange={set("registrationUrl")} placeholder="https://" />
      </Field>
      <Field label="Precio (opcional)" htmlFor="price" error={errors.price}>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-subtle">$</span>
          <Input id="price" inputMode="decimal" value={v.price ?? ""} onChange={set("price")} className="pl-8 font-mono" />
        </div>
      </Field>
      <Field label="Notas" htmlFor="notes">
        <Textarea id="notes" value={v.notes ?? ""} onChange={set("notes")} maxLength={2000} placeholder="Punto de encuentro, traslado, qué llevar…" />
      </Field>
      <Button
        block
        size="lg"
        loading={pending}
        onClick={() =>
          start(async () => {
            setErrors({});
            const res = await saveEvent(v);
            if (!res.ok) {
              setErrors(res.fieldErrors ?? {});
              return void toast.error(res.error);
            }
            toast.success(res.message);
            router.push(`/eventos/${res.data!.id}`);
            router.refresh();
          })
        }
      >
        {v.id ? "Guardar cambios" : "Publicar evento"}
      </Button>
      {v.id && (
        <Button
          variant="danger"
          block
          disabled={pending}
          onClick={() => {
            if (!confirm("¿Eliminar el evento? También se borran los inscriptos.")) return;
            start(async () => {
              const res = await deleteEvent(v.id!);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              router.replace("/eventos");
            });
          }}
        >
          <Trash2 /> Eliminar evento
        </Button>
      )}
    </div>
  );
}
