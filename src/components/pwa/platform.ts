export function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isAndroid() {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export type Platform = "ios" | "android" | "desktop" | "installed";

export function detectPlatform(): Platform {
  return isStandalone() ? "installed" : isIos() ? "ios" : isAndroid() ? "android" : "desktop";
}

const noopSubscribe = () => () => {};
/** Para useSyncExternalStore: el dispositivo no cambia durante la sesión. */
export const platformStore = {
  subscribe: noopSubscribe,
  getSnapshot: detectPlatform,
  getServerSnapshot: () => null as Platform | null,
};
