import { ImageResponse } from "next/og";
import { getPublicClub } from "@/lib/club";
import { initials, readableOn } from "@/lib/domain/color";
import { publicStorageUrl } from "@/lib/utils";

const SIZES: Record<string, { size: number; padding: number; radius: number }> = {
  favicon: { size: 32, padding: 0, radius: 0.22 },
  "192": { size: 192, padding: 0, radius: 0 },
  "512": { size: 512, padding: 0, radius: 0 },
  maskable: { size: 512, padding: 0.18, radius: 0 }, // zona segura del 80 %
  apple: { size: 180, padding: 0, radius: 0 },
  badge: { size: 96, padding: 0.1, radius: 0 },
};

/** Íconos PWA generados por club: logo o iniciales sobre el color del club. */
export async function GET(_req: Request, { params }: RouteContext<"/c/[club]/icon/[variant]">) {
  const { club: slug, variant } = await params;
  const spec = SIZES[variant];
  const club = await getPublicClub(slug);
  if (!club || !spec) return new Response("Not found", { status: 404 });

  const { size, padding, radius } = spec;
  const inner = Math.round(size * (1 - padding * 2));
  const logo = publicStorageUrl("branding", club.logo_path);
  const fg = readableOn(club.primary_color);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: logo ? "#15110E" : club.primary_color,
          borderRadius: radius * size,
        }}
      >
        {logo ? (
          <img src={logo} width={inner} height={inner} style={{ objectFit: "contain" }} alt="" />
        ) : (
          <span style={{ color: fg, fontSize: inner * 0.46, fontWeight: 800, letterSpacing: -inner * 0.01 }}>
            {initials(club.name) || "?"}
          </span>
        )}
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } },
  );
}
