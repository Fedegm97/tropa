import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { PLATFORM_NAME } from "@/lib/env";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-barlow",
  display: "swap",
});
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: { default: PLATFORM_NAME, template: `%s · ${PLATFORM_NAME}` },
  description: "La app de tu running team, con tu marca.",
};

export const viewport: Viewport = {
  themeColor: "#15110E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${inter.variable} ${barlow.variable} ${jetbrains.variable}`}>
      <body className="antialiased">
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: { background: "#2A231E", border: "1px solid #3A312A", color: "#F6EFE9", borderRadius: 16 },
          }}
        />
      </body>
    </html>
  );
}
