import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageHeader({ title, back, action, subtitle }: { title: string; back?: string; action?: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end gap-2">
      {back && (
        <Link href={back} aria-label="Volver" className="-ml-2 grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2">
          <ChevronLeft className="size-6" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-4xl font-extrabold uppercase leading-none">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}
