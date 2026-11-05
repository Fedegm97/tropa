"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { deleteFeeRule, saveFeeRule, updateClubSettings } from "./actions";

type Option = { id: string; name: string };

export function FeeRuleForm({ shifts, runners, defaultPeriod }: { shifts: Option[]; runners: Option[]; defaultPeriod: string }) {
  const router = useRouter();
  const [scope, setScope] = useState<"club" | "shift" | "runner">("club");
  const [targetId, setTargetId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [validFrom, setValidFrom] = useState(defaultPeriod.slice(0, 7));
  const [pending, start] = useTransition();
  const options = scope === "shift" ? shifts : runners;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Aplica a">
          <Select value={scope} onChange={(e) => (setScope(e.target.value as typeof scope), setTargetId(""))}>
            <option value="club">Todo el club</option>
            <option value="shift" disabled={shifts.length === 0}>
              Un turno
            </option>
            <option value="runner">Un corredor</option>
          </Select>
        </Field>
        <Field label="Desde">
          <Input type="month" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="font-mono" />
        </Field>
      </div>
      {scope !== "club" && (
        <Field label={scope === "shift" ? "Turno" : "Corredor"}>
          <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">Elegí…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Monto mensual" hint={scope === "runner" ? "Poné 0 para becados." : undefined}>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-subtle">$</span>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25.000" className="pl-8 font-mono" />
        </div>
      </Field>
      <Button
        block
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await saveFeeRule({ scope, targetId: targetId || null, amount, validFrom: `${validFrom}-01` });
            if (!res.ok) return void toast.error(res.error);
            toast.success(res.message);
            setAmount("");
            router.refresh();
          })
        }
      >
        Guardar monto
      </Button>
    </div>
  );
}

export function DeleteRuleButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Borrar monto"
      loading={pending}
      onClick={() =>
        start(async () => {
          await deleteFeeRule(id);
          router.refresh();
        })
      }
    >
      {!pending && <Trash2 />}
    </Button>
  );
}

export function ReminderDayForm({ day, canEdit }: { day: number; canEdit: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(String(day));
  const [pending, start] = useTransition();
  return (
    <div className="flex items-end gap-2">
      <Field label="Día del mes" className="flex-1" hint="A las 9:00 avisamos por push a quienes todavía deben.">
        <Input type="number" min={1} max={28} value={value} onChange={(e) => setValue(e.target.value)} disabled={!canEdit} className="font-mono" />
      </Field>
      {canEdit && (
        <Button
          className="mb-7"
          variant="secondary"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await updateClubSettings({ fee_reminder_day: Number(value) });
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              router.refresh();
            })
          }
        >
          Guardar
        </Button>
      )}
    </div>
  );
}

export function BirthdayToggle({ enabled, canEdit }: { enabled: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="flex min-h-11 items-center gap-3">
      <input
        type="checkbox"
        className="size-5 accent-[var(--accent)]"
        checked={enabled}
        disabled={!canEdit || pending}
        onChange={(e) =>
          start(async () => {
            const res = await updateClubSettings({ birthday_greeting: e.target.checked });
            if (!res.ok) return void toast.error(res.error);
            router.refresh();
          })
        }
      />
      <span className="text-sm">Saludar automáticamente en nombre del club el día del cumpleaños</span>
    </label>
  );
}
