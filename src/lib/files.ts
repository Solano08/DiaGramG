export function isSupportedFile(file: File) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === "application/pdf" ||
    name.endsWith(".pdf") ||
    type.startsWith("image/")
  );
}
