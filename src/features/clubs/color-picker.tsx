"use client";

import { Check } from "lucide-react";
import { SWATCHES, readableOn } from "@/lib/domain/color";
import { cn } from "@/lib/utils";

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const isCustom = !SWATCHES.some((s) => s.toLowerCase() === value.toLowerCase());
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Color principal">
      {SWATCHES.map((s) => {
        const selected = s.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Color ${s}`}
            onClick={() => onChange(s)}
            className={cn("grid size-11 place-items-center rounded-full ring-offset-2 ring-offset-bg transition", selected && "ring-2 ring-fg")}
            style={{ background: s }}
          >
            {selected && <Check className="size-5" style={{ color: readableOn(s) }} aria-hidden />}
          </button>
        );
      })}
      <label
        className={cn(
          "relative grid size-11 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-border ring-offset-2 ring-offset-bg",
          isCustom && "ring-2 ring-fg",
        )}
        style={isCustom ? { background: value } : undefined}
        title="Color personalizado"
      >
        <span className="text-lg font-semibold" style={{ color: isCustom ? readableOn(value) : undefined }} aria-hidden>
          +
        </span>
        <span className="sr-only">Elegir un color personalizado</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <span className="ml-1 font-mono text-xs text-subtle">{value.toUpperCase()}</span>
    </div>
  );
}
