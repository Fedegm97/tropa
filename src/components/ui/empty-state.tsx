import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Estado vacío con "ilustración" (ícono sobre círculos del color del club) y CTA. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-card border border-dashed border-border px-6 py-10 text-center", className)}>
      <div className="relative mb-4 grid size-24 place-items-center">
        <span className="absolute inset-0 rounded-full bg-accent/10" />
        <span className="absolute inset-3 rounded-full bg-accent/15" />
        <Icon className="relative size-9 text-accent-text" aria-hidden />
      </div>
      <h3 className="font-display text-2xl font-bold uppercase">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
