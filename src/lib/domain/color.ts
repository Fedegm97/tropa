/** Utilidades de color para el branding por club (contraste AA). */

export const SWATCHES = ["#FF5A1F", "#FFC531", "#2BD576", "#21B8F0", "#7C5CFF", "#FF3D7F"] as const;

export const DARK_BG = "#15110E";

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Texto legible (negro o blanco) sobre un fondo del color del club. */
export function readableOn(bg: string): "#0B0907" | "#FFFFFF" {
  return contrastRatio(bg, "#0B0907") >= contrastRatio(bg, "#FFFFFF") ? "#0B0907" : "#FFFFFF";
}

/**
 * Variante del color del club apta para texto/íconos sobre el fondo oscuro:
 * se aclara hasta llegar a contraste AA (4.5:1).
 */
export function accentForDarkBg(hex: string, bg: string = DARK_BG, min = 4.5): string {
  let [r, g, b] = rgb(hex);
  let current = toHex([r, g, b]);
  for (let i = 0; i < 20 && contrastRatio(current, bg) < min; i++) {
    r += (255 - r) * 0.15;
    g += (255 - g) * 0.15;
    b += (255 - b) * 0.15;
    current = toHex([r, g, b]);
  }
  return current;
}

/** "Río Norte Running Team" → "RN" */
export function initials(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^(de|del|la|las|los|el|y|running|team|club|rt)$/i.test(w));
  const source = words.length > 0 ? words : name.split(/\s+/).filter(Boolean);
  return source
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
