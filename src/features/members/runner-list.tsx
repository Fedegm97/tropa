"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Avatar } from "@/components/brand/club-badge";
import { Badge, Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { formatPace } from "@/lib/domain/pace";
import { LEVELS, type Level } from "./schemas";

export type RunnerRow = {
  userId: string;
  name: string;
  avatar: string | null;
  role: "owner" | "coach" | "runner";
  shiftId: string | null;
  shiftName: string | null;
  level: Level | null;
  pace: number | null;
  paceKind: "5k" | "threshold";
};

export function RunnerList({ rows, shifts }: { rows: RunnerRow[]; shifts: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [shift, setShift] = useState("all");
  const filtered = useMemo(() => {
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return rows.filter(
      (r) => norm(r.name).includes(norm(q)) && (shift === "all" || (shift === "none" ? !r.shiftId : r.shiftId === shift)),
    );
  }, [rows, q, shift]);

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="pl-10" aria-label="Buscar corredor" />
        </div>
        <Select value={shift} onChange={(e) => setShift(e.target.value)} className="w-36" aria-label="Filtrar por turno">
          <option value="all">Todos</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          <option value="none">Sin turno</option>
        </Select>
      </div>
      <p className="mb-2 font-mono text-xs text-subtle">{filtered.length} personas</p>
      <div className="space-y-2">
        {filtered.map((r) => (
          <Link key={r.userId} href={`/corredores/${r.userId}`} className="block">
            <Card className="flex items-center gap-3 p-3 hover:bg-surface-2">
              <Avatar name={r.name} path={r.avatar} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name}</p>
                <p className="truncate font-mono text-xs text-muted">
                  {r.shiftName ?? "Sin turno"}
                  {r.level && ` · ${LEVELS[r.level]}`}
                  {r.pace && ` · ${formatPace(r.pace)} ${r.paceKind === "5k" ? "5K" : "umbral"}`}
                </p>
              </div>
              {r.role !== "runner" && <Badge tone="accent">{r.role === "owner" ? "owner" : "coach"}</Badge>}
              <ChevronRight className="size-5 text-subtle" aria-hidden />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
