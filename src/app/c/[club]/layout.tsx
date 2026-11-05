import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { accentForDarkBg, readableOn } from "@/lib/domain/color";
import { getPublicClub } from "@/lib/club";

export async function generateMetadata({ params }: LayoutProps<"/c/[club]">): Promise<Metadata> {
  const { club: slug } = await params;
  const club = await getPublicClub(slug);
  if (!club) return {};
  const v = encodeURIComponent(club.logo_path ?? club.primary_color);
  return {
    title: { default: club.name, template: `%s · ${club.name}` },
    applicationName: club.name,
    manifest: `/manifest.webmanifest?v=${v}`,
    icons: {
      icon: [{ url: `/icon/favicon?v=${v}`, sizes: "32x32", type: "image/png" }, { url: `/icon/192?v=${v}`, sizes: "192x192", type: "image/png" }],
      apple: [{ url: `/icon/apple?v=${v}`, sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: { capable: true, title: club.name.slice(0, 30), statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
  };
}

export async function generateViewport({ params }: LayoutProps<"/c/[club]">): Promise<Viewport> {
  const { club: slug } = await params;
  const club = await getPublicClub(slug);
  return { themeColor: club?.primary_color ?? "#15110E", viewportFit: "cover", width: "device-width", initialScale: 1 };
}

export default async function ClubLayout({ children, params }: LayoutProps<"/c/[club]">) {
  const { club: slug } = await params;
  const club = await getPublicClub(slug);
  if (!club) notFound();

  const style = {
    "--accent": club.primary_color,
    "--accent-fg": readableOn(club.primary_color),
    "--accent-text": accentForDarkBg(club.primary_color),
  } as React.CSSProperties;

  return (
    <div style={style} className="min-h-dvh">
      {children}
      <ServiceWorkerRegister />
    </div>
  );
}
