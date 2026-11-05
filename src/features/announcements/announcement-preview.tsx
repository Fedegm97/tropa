import Link from "next/link";
import { Pin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function AnnouncementPreview({
  a,
}: {
  a: { id: string; body: string; pinned_at: string | null; published_at: string; profiles: { full_name: string } | null };
}) {
  return (
    <Link href={`/avisos#${a.id}`} className="block">
      <Card className="hover:bg-surface-2">
        <div className="mb-1 flex items-center gap-2 font-mono text-[11px] uppercase text-subtle">
          {a.pinned_at && <Pin className="size-3 text-accent-text" aria-label="Fijado" />}
          <span>{a.profiles?.full_name ?? "Coach"}</span>
          <span>· {formatDistanceToNow(new Date(a.published_at), { locale: es, addSuffix: true })}</span>
        </div>
        <p className="line-clamp-2 text-sm">{a.body}</p>
      </Card>
    </Link>
  );
}
