import Link from "next/link";
import { CalendarHeart, ChevronRight, HeartPulse, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatusTile({
  href,
  icon: Icon,
  label,
  value,
  tone = "neutral",
  sub,
}: {
  href: string;
  icon: typeof Wallet;
  label: string;
  value: string;
  tone?: "success" | "warning" | "danger" | "neutral";
  sub?: string;
}) {
  const color = { success: "text-success", warning: "text-warning", danger: "text-danger", neutral: "text-fg" }[tone];
  return (
    <Link href={href} className="block">
      <Card className="h-full p-3 hover:bg-surface-2">
        <div className="flex items-center justify-between">
          <Icon className="size-5 text-accent-text" aria-hidden />
          <ChevronRight className="size-4 text-subtle" aria-hidden />
        </div>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-subtle">{label}</p>
        <p className={cn("font-display text-xl font-bold uppercase leading-tight", color)}>{value}</p>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </Card>
    </Link>
  );
}

export const icons = { Wallet, HeartPulse, CalendarHeart };
