"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { adminSetPlan } from "./actions";

type Status = "trialing" | "active" | "past_due" | "canceled";

export function AdminPlanForm({ clubId, plan, status, override }: { clubId: string; plan: string; status: Status; override: boolean }) {
  const [p, setP] = useState(plan);
  const [s, setS] = useState<Status>(status);
  const [o, setO] = useState(override);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={p} onChange={(e) => setP(e.target.value)} className="h-11 w-28" aria-label="Plan">
        {["free", "coach", "team", "club"].map((x) => (
          <option key={x}>{x}</option>
        ))}
      </Select>
      <Select value={s} onChange={(e) => setS(e.target.value as Status)} className="h-11 w-32" aria-label="Estado">
        {["active", "trialing", "past_due", "canceled"].map((x) => (
          <option key={x}>{x}</option>
        ))}
      </Select>
      <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={o} onChange={(e) => setO(e.target.checked)} className="size-5 accent-[var(--accent)]" /> Piloto
      </label>
      <Button
        size="sm"
        variant="secondary"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await adminSetPlan({ clubId, plan: p, status: s, override: o });
            if (res.ok) toast.success(res.message);
            else toast.error(res.error);
          })
        }
      >
        Guardar
      </Button>
    </div>
  );
}
