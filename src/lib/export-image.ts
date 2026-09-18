import { sceneFromDiagram, type SceneNode } from "./diagram-scene";
import type { Diagram } from "./schema";

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrapLines(label: string, maxChars: number) {
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [label];
}

function fillOf(kind: SceneNode["kind"]) {
  switch (kind) {
    case "start":
      return { fill: "#e8f5ef", stroke: "#2f7d66", radius: 999 };
    case "end":
      return { fill: "#f8ece4", stroke: "#b44a1f", radius: 999 };
    case "decision":
      return { fill: "#fff4cc", stroke: "#c3992a", radius: 10 };
    case "system":
      return { fill: "#eef3f8", stroke: "#4d6a88", radius: 6 };
    case "actor":
      return { fill: "#f3efe8", stroke: "#7a6a55", radius: 6 };
    case "data":
      return { fill: "#eef2f6", stroke: "#5b6d82", radius: 6 };
    case "io":
      return { fill: "#f3f6ee", stroke: "#5d7354", radius: 6 };
    case "note":
      return { fill: "#fff7bf", stroke: "#e0c86a", radius: 2 };
    case "document":
      return { fill: "#f7f3ea", stroke: "#8a7a5c", radius: 6 };
    default:
      return { fill: "#fffefb", stroke: "#4d5d73", radius: 6 };
  }
}

function nodeText(node: SceneNode) {
  const lines = wrapLines(node.label, node.kind === "decision" ? 16 : 20);
  const start = node.y + node.h / 2 - ((lines.length - 1) * 8);
  return lines
    .map(
      (line, index) =>
        `<text x="${node.x + node.w / 2}" y="${start + index * 16}" text-anchor="middle" fill="#1b1914" font-size="13" font-weight="650" font-family="Segoe UI, system-ui, sans-serif">${esc(line)}</text>`,
    )
    .join("");
}

export function diagramToSvg(diagram: Diagram) {
  const scene = sceneFromDiagram(diagram);
  const groups = scene.groups
    .map(
      (group) =>
        `<g>
          <rect x="${group.x}" y="${group.y}" width="${group.w}" height="${group.h}" rx="16" fill="rgba(255,255,255,0.35)" stroke="#cbbfaa" stroke-dasharray="5 4" />
          <text x="${group.x + 16}" y="${group.y + 22}" fill="#6e8b7f" font-size="11" letter-spacing="1.4" font-family="Segoe UI, system-ui, sans-serif">${esc(group.label.toUpperCase())}</text>
        </g>`,
    )
    .join("");

  const edges = scene.edges
    .map((edge) => {
      const color =
        edge.kind === "success" ? "#0f6e5c" : edge.kind === "warning" ? "#b44a1f" : "#3f3a34";
      const dash = edge.kind === "dash" ? ` stroke-dasharray="7 5"` : "";
      const label = edge.label
        ? (() => {
            const width = Math.max(32, edge.label.length * 7.4 + 16);
            return `<g>
              <rect x="${edge.mid.x - width / 2}" y="${edge.mid.y - 11}" width="${width}" height="20" rx="10" fill="#f7f4ee" stroke="#cfc6b6" />
              <text x="${edge.mid.x}" y="${edge.mid.y + 4}" text-anchor="middle" fill="#1b1914" font-size="12" font-weight="700" font-family="Segoe UI, system-ui, sans-serif">${esc(edge.label)}</text>
            </g>`;
          })()
        : "";
      return `<path d="${edge.d}" fill="none" stroke="${color}" stroke-width="2" marker-end="url(#arrow)"${dash} />${label}`;
    })
    .join("");

  const nodes = scene.nodes
    .map((node) => {
      const style = fillOf(node.kind);
      const badge = node.badge
        ? `<g>
            <rect x="${node.x + node.w - 22}" y="${node.y - 8}" width="${Math.max(22, node.badge.length * 7 + 12)}" height="16" rx="8" fill="#0f6e5c" />
            <text x="${node.x + node.w - 11}" y="${node.y + 4}" text-anchor="middle" fill="#fff" font-size="10" font-weight="700" font-family="Segoe UI, system-ui, sans-serif">${esc(node.badge)}</text>
          </g>`
        : "";
      return `<g>
        <rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="${style.radius}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2" />
        ${nodeText(node)}
        ${badge}
      </g>`;
    })
    .join("");

  const notes = scene.notes
    .map(
      (item) =>
        `<g>
          <rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" fill="#fff7bf" stroke="#e0c86a" />
          <text x="${item.x + 10}" y="${item.y + 22}" fill="#5a4e32" font-size="12" font-family="Segoe UI, system-ui, sans-serif">${esc(item.note)}</text>
        </g>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">
  <rect width="100%" height="100%" fill="#f7f4ee" />
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#3f3a34" />
    </marker>
  </defs>
  ${groups}
  ${edges}
  ${nodes}
  ${notes}
</svg>`;
}

function triggerDownload(filename: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}

export function downloadSvgFile(filename: string, svg: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  triggerDownload(filename, url);
  URL.revokeObjectURL(url);
}

export async function downloadPngFile(filename: string, svg: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No se pudo rasterizar el SVG."));
      img.src = url;
    });
    const max = 8192;
    const scale = Math.min(2, max / Math.max(image.width, 1), max / Math.max(image.height, 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear el lienzo PNG.");
    ctx.fillStyle = "#f7f4ee";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (file) => (file ? resolve(file) : reject(new Error("No se pudo generar el PNG."))),
        "image/png",
      );
    });
    const pngUrl = URL.createObjectURL(png);
    triggerDownload(filename, pngUrl);
    URL.revokeObjectURL(pngUrl);
  } finally {
    URL.revokeObjectURL(url);
  }
}
