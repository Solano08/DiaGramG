export function isSupportedFile(file: File) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === "application/pdf" ||
    name.endsWith(".pdf") ||
    type.startsWith("image/")
  );
}

/** Vercel Functions rechazan bodies de más de 4.5 MB. */
export const CONVERT_UPLOAD_LIMIT = 4 * 1024 * 1024;

export async function toJpegFile(source: Blob, filename: string, quality = 0.86) {
  try {
    const bitmap = await createImageBitmap(source);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return new File([source], filename, { type: source.type || "image/png" });
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(new Error("No se pudo comprimir la imagen.")),
        "image/jpeg",
        quality,
      );
    });
    return new File([blob], filename.replace(/\.[a-z0-9]+$/i, ".jpg"), {
      type: "image/jpeg",
    });
  } catch {
    return new File([source], filename, { type: source.type || "image/png" });
  }
}
