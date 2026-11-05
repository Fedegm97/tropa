"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { formatPace } from "@/lib/domain/pace";
import { deactivateMember, setMemberRole, updateRunner } from "./actions";
import { LEVELS, type Level } from "./schemas";

export function RunnerAdminForm({
  userId,
  role,
  shiftId,
  level,
  pace,
  paceKind,
  shifts,
  canManageRoles,
  isSelf,
}: {
  userId: string;
  role: "owner" | "coach" | "runner";
  shiftId: string | null;
  level: Level | null;
  pace: number | null;
  paceKind: "5k" | "threshold";
  shifts: { id: string; name: string }[];
  canManageRoles: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [s, setS] = useState(shiftId ?? "");
  const [l, setL] = useState<string>(level ?? "");
  const [p, setP] = useState(pace ? formatPace(pace) : "");
  const [k, setK] = useState(paceKind);

  return (
    <Card className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Turno">
          <Select value={s} onChange={(e) => setS(e.target.value)}>
            <option value="">Sin turno</option>
            {shifts.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nivel">
          <Select value={l} onChange={(e) => setL(e.target.value)}>
            <option value="">Sin definir</option>
            {(Object.keys(LEVELS) as Level[]).map((x) => (
              <option key={x} value={x}>
                {LEVELS[x]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ritmo de referencia" error={errors.pace} hint="min:seg por km">
          <Input value={p} onChange={(e) => setP(e.target.value)} placeholder="4:45" inputMode="numeric" className="font-mono" />
        </Field>
        <Field label="Medido en">
          <Select value={k} onChange={(e) => setK(e.target.value as "5k" | "threshold")}>
            <option value="5k">5K</option>
            <option value="threshold">Umbral</option>
          </Select>
        </Field>
      </div>
      <Button
        block
        loading={pending}
        onClick={() =>
          start(async () => {
            setErrors({});
            const res = await updateRunner({ userId, shiftId: s || null, level: (l || null) as Level | null, pace: p, paceKind: k });
            if (!res.ok) {
              setErrors(res.fieldErrors ?? {});
              return void toast.error(res.error);
            }
            toast.success(res.message);
            router.refresh();
          })
        }
      >
        Guardar
      </Button>

      {canManageRoles && !isSelf && role !== "owner" && (
        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await setMemberRole(userId, role === "coach" ? "runner" : "coach");
                if (!res.ok) return void toast.error(res.error);
                toast.success(res.message);
                router.refresh();
              })
            }
          >
            {role === "coach" ? "Pasar a corredor" : "Hacer coach"}
          </Button>
        </div>
      )}
      {!isSelf && role !== "owner" && (role === "runner" || canManageRoles) && (
        <Button
          variant="danger"
          block
          disabled={pending}
          onClick={() => {
            if (!confirm("¿Dar de baja del club? Sus datos quedan guardados.")) return;
            start(async () => {
              const res = await deactivateMember(userId);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              router.replace("/corredores");
            });
          }}
        >
          Dar de baja
        </Button>
      )}
    </Card>
  );
}
