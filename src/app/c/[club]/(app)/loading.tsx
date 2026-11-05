import { Skeleton } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-32" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}
