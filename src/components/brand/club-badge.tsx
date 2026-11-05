import { initials, readableOn } from "@/lib/domain/color";
import { cn, publicStorageUrl } from "@/lib/utils";

/** Logo del club o, si no hay, sus iniciales sobre el color del club. */
export function ClubBadge({
  name,
  color,
  logoPath,
  logoUrl,
  size = 40,
  className,
}: {
  name: string;
  color: string;
  logoPath?: string | null;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const src = logoUrl ?? publicStorageUrl("branding", logoPath);
  const style = { width: size, height: size, borderRadius: size * 0.28 };
  if (src) {
    return <img src={src} alt={name} style={style} className={cn("shrink-0 bg-surface-2 object-cover", className)} />;
  }
  return (
    <span
      aria-label={name}
      style={{ ...style, background: color, color: readableOn(color), fontSize: size * 0.42 }}
      className={cn("grid shrink-0 place-items-center font-display font-extrabold leading-none", className)}
    >
      {initials(name) || "?"}
    </span>
  );
}

export function Avatar({
  name,
  path,
  size = 36,
  className,
}: {
  name: string;
  path?: string | null;
  size?: number;
  className?: string;
}) {
  const src = publicStorageUrl("avatars", path);
  const style = { width: size, height: size };
  if (src) return <img src={src} alt={name} style={style} className={cn("shrink-0 rounded-full object-cover", className)} />;
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-label={name}
      style={{ ...style, fontSize: size * 0.38 }}
      className={cn("grid shrink-0 place-items-center rounded-full bg-surface-2 font-semibold text-muted", className)}
    >
      {letters || "?"}
    </span>
  );
}

export function AvatarStack({ people, max = 5, total }: { people: { name: string; path?: string | null }[]; max?: number; total?: number }) {
  const shown = people.slice(0, max);
  const rest = (total ?? people.length) - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <Avatar key={i} name={p.name} path={p.path} size={28} className="-ml-2 ring-2 ring-surface first:ml-0" />
      ))}
      {rest > 0 && <span className="ml-2 font-mono text-xs text-muted">+{rest}</span>}
    </div>
  );
}
