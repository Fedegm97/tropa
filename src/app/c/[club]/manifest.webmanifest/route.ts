import { getPublicClub } from "@/lib/club";

/** Manifest dinámico por club: nombre, colores e íconos propios. */
export async function GET(_req: Request, { params }: RouteContext<"/c/[club]/manifest.webmanifest">) {
  const { club: slug } = await params;
  const club = await getPublicClub(slug);
  if (!club) return new Response("Not found", { status: 404 });
  const v = encodeURIComponent(club.logo_path ?? club.primary_color);

  const manifest = {
    id: "/",
    name: club.name,
    short_name: club.name.length > 12 ? club.name.split(/\s+/).slice(0, 2).join(" ").slice(0, 12) : club.name,
    description: `La app de ${club.name}`,
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#15110E",
    theme_color: club.primary_color,
    lang: "es-AR",
    categories: ["sports", "health", "fitness"],
    icons: [
      { src: `/icon/192?v=${v}`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/icon/512?v=${v}`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/icon/maskable?v=${v}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" },
  });
}
