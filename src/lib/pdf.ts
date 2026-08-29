import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

let workerReady = false;

function ensureWorker() {
  if (workerReady) return;
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  workerReady = true;
}

export async function renderPdfPages(
  file: File,
  options?: {
    scale?: number;
    quality?: number;
    maxPages?: number;
    format?: "jpeg" | "png";
  },
): Promise<string[]> {
  ensureWorker();
  const scale = options?.scale ?? 1.35;
  const quality = options?.quality ?? 0.82;
  const maxPages = options?.maxPages ?? 8;
  const format = options?.format ?? "jpeg";
  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const count = Math.min(pdf.numPages, maxPages);
  const pages: string[] = [];

  for (let i = 1; i <= count; i += 1) {
    const page = await pdf.getPage(i);
    let viewport = page.getViewport({ scale });
    const maxEdge = 2000;
    const longest = Math.max(viewport.width, viewport.height);
    if (longest > maxEdge) {
      viewport = page.getViewport({ scale: scale * (maxEdge / longest) });
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;
    pages.push(
      format === "png"
        ? canvas.toDataURL("image/png")
        : canvas.toDataURL("image/jpeg", quality),
    );
  }

  return pages;
}
