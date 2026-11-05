"use client";
import imageCompression from "browser-image-compression";

/** Comprime en el cliente antes de subir (máx. 1 MB por defecto, WebP). */
export async function compressImage(
  file: File,
  opts: { maxSizeMB?: number; maxWidthOrHeight?: number; fileType?: "image/webp" | "image/png" | "image/jpeg" } = {},
): Promise<File> {
  if (file.type === "application/pdf") return file;
  return imageCompression(file, {
    maxSizeMB: opts.maxSizeMB ?? 1,
    maxWidthOrHeight: opts.maxWidthOrHeight ?? 1600,
    useWebWorker: true,
    fileType: opts.fileType ?? "image/webp",
  });
}
