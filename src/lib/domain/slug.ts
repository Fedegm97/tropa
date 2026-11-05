export const SLUG_REGEX = /^[a-z0-9]([a-z0-9-]{1,30})[a-z0-9]$/;

/** "Río Norte Running Team" → "rionorte" (corto, sin acentos) */
export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(running team|running club|running|team|club|grupo)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 32);
  if (base.length >= 3) return base;
  // Si quedó muy corto, usamos el nombre completo con guiones
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug) && !slug.includes("--");
}
