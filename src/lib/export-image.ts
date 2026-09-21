import { sceneFromDiagram, type DiagramScene, type SceneNode } from "./diagram-scene";
import type { Diagram } from "./schema";

const CARD = "#fffdf8";
const INK = "#171410";
const MUTED = "#6a6358";
const TEAL = "#0f6e5c";
const CLAY = "#c45c26";
const EDGE = "#8a8174";
const LABEL_BG = "#f4efe6";
const FONT_SANS = 'Geist, "Segoe UI", system-ui, sans-serif';
const FONT_SERIF = '"Instrument Serif", Georgia, serif';
const FONT_IMPORT =
  '@import url("https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap");';

type SvgTheme = {
  sans: string;
  serif: string;
  extraCss?: string;
};

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrapLines(label: string, maxChars: number) {
  const limit = Math.max(4, maxChars);
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  const flush = () => {
    if (!current) return;
    lines.push(current);
    current = "";
  };
  for (const word of words) {
    if (word.length > limit) {
      flush();
      let rest = word;
      while (rest.length > limit) {
        lines.push(rest.slice(0, limit));
        rest = rest.slice(limit);
      }
      current = rest;
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length > limit && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  flush();
  return lines.length ? lines : [label];
}

function fillOf(kind: SceneNode["kind"]) {
  switch (kind) {
    case "start":
      return { fill: "#e8f5ef", stroke: "#2f7d66", radius: 999, strokeWidth: 2 };
    case "end":
      return { fill: "#f8ece4", stroke: "#b44a1f", radius: 999, strokeWidth: 2 };
    case "decision":
      return { fill: "#fff4cc", stroke: "#c3992a", radius: 10, strokeWidth: 2 };
    case "system":
      return { fill: "#eef3f8", stroke: "#4d6a88", radius: 6, strokeWidth: 2 };
    case "actor":
      return { fill: "#f3efe8", stroke: "#7a6a55", radius: 6, strokeWidth: 2 };
    case "data":
      return { fill: "#eef2f6", stroke: "#5b6d82", radius: 6, strokeWidth: 2 };
    case "io":
      return { fill: "#f3f6ee", stroke: "#5d7354", radius: 6, strokeWidth: 2 };
    case "note":
      return { fill: "#fff7bf", stroke: "#e0c86a", radius: 2, strokeWidth: 1 };
    case "document":
      return { fill: "#f7f3ea", stroke: "#8a7a5c", radius: 6, strokeWidth: 2 };
    default:
      return { fill: CARD, stroke: "#4d5d73", radius: 6, strokeWidth: 2 };
  }
}

function cornerRadius(kind: SceneNode["kind"], w: number, h: number) {
  const style = fillOf(kind);
  if (style.radius >= 999) return Math.min(w, h) / 2;
  return Math.min(style.radius, w / 2, h / 2);
}

function edgeLook(kind: string) {
  if (kind === "success") return { stroke: TEAL, marker: "arrow-teal" };
  if (kind === "warning") return { stroke: CLAY, marker: "arrow-clay" };
  return { stroke: EDGE, marker: "arrow" };
}

function nodeText(node: SceneNode) {
  const maxChars = Math.max(8, Math.floor((node.w - 24) / 7.4));
  const lines = wrapLines(
    node.label,
    node.kind === "decision" ? Math.min(16, maxChars) : maxChars,
  );
  const lineH = 16.25;
  const start = node.y + node.h / 2 - ((lines.length - 1) * lineH) / 2;
  return lines
    .map(
      (line, index) =>
        `<text class="sans" x="${node.x + node.w / 2}" y="${start + index * lineH}" text-anchor="middle" dominant-baseline="middle" fill="${INK}" font-size="13" font-weight="650">${esc(line)}</text>`,
    )
    .join("");
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(blob);
  });
}

async function inlineCssUrls(css: string, baseHref: string) {
  const matches = [...css.matchAll(/url\((["']?)([^"')]+)\1\)/g)];
  let out = css;
  for (const match of matches) {
    const raw = match[2];
    if (!raw || raw.startsWith("data:")) continue;
    try {
      const href = new URL(raw, baseHref).href;
      const res = await fetch(href);
      if (!res.ok) continue;
      const data = await blobToDataUrl(await res.blob());
      out = out.replaceAll(match[0], `url("${data}")`);
    } catch {
      // Si una fuente no se puede incrustar, el raster sigue con el fallback del sistema.
    }
  }
  return out;
}

function quoteFamily(name: string) {
  const value = name.replaceAll(/["']/g, "").trim();
  if (!value) return "";
  return `"${value}"`;
}

async function themeForRaster(): Promise<SvgTheme> {
  const fallback: SvgTheme = {
    sans: '"Segoe UI", system-ui, sans-serif',
    serif: "Georgia, Palatino, serif",
  };
  if (typeof document === "undefined") return fallback;
  try {
    await document.fonts.ready;
  } catch {
    return fallback;
  }

  const faces: string[] = [];
  let sans = "";
  let serif = "";
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    const baseHref = sheet.href || document.baseURI;
    for (const rule of rules) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = rule.style.getPropertyValue("font-family").replaceAll(/["']/g, "");
      const useful =
        (/geist/i.test(family) && !/mono/i.test(family)) || /instrument/i.test(family);
      if (!useful) continue;
      faces.push(await inlineCssUrls(rule.cssText, baseHref));
      if (/geist/i.test(family) && !sans) sans = family;
      if (/instrument/i.test(family) && !serif) serif = family;
    }
  }

  const bodySans = getComputedStyle(document.body).fontFamily;
  return {
    sans: sans ? `${quoteFamily(sans)}, "Segoe UI", system-ui, sans-serif` : bodySans || fallback.sans,
    serif: serif ? `${quoteFamily(serif)}, Georgia, serif` : fallback.serif,
    extraCss: faces.join("\n"),
  };
}

export function diagramToSvg(diagram: Diagram, theme?: SvgTheme, scene?: DiagramScene) {
  const used = scene ?? sceneFromDiagram(diagram);
  const fonts = theme ?? { sans: FONT_SANS, serif: FONT_SERIF, extraCss: FONT_IMPORT };
  const eyebrow = (diagram.subtitle || diagram.type).toUpperCase();
  const titleLines = wrapLines(
    diagram.title,
    Math.max(18, Math.floor((used.width - 40) / 15)),
  );
  const headerH = 48 + titleLines.length * 34;
  const padX = 16;
  const padBottom = 20;
  const width = Math.ceil(used.width + padX * 2);
  const height = Math.ceil(headerH + used.height + padBottom);

  const groups = used.groups
    .map(
      (group) =>
        `<g>
          <rect x="${group.x}" y="${group.y}" width="${group.w}" height="${group.h}" rx="16" fill="rgba(255,253,248,0.4)" stroke="#cbbfaa" stroke-width="1.5" stroke-dasharray="5 4" />
          <text class="sans" x="${group.x + 22}" y="${group.y + 28}" fill="${TEAL}" font-size="11" font-weight="500" letter-spacing="1.76">${esc(group.label.toUpperCase())}</text>
        </g>`,
    )
    .join("");

  const edges = used.edges
    .map((edge) => {
      const look = edgeLook(edge.kind);
      const dash = edge.kind === "dash" ? ` stroke-dasharray="7 6"` : "";
      const label = edge.label
        ? (() => {
            const widthLabel = Math.max(32, edge.label.length * 6.6 + 16);
            const heightLabel = 18;
            return `<g>
              <rect x="${edge.mid.x - widthLabel / 2}" y="${edge.mid.y - heightLabel / 2}" width="${widthLabel}" height="${heightLabel}" rx="4" fill="${LABEL_BG}" />
              <text class="sans" x="${edge.mid.x}" y="${edge.mid.y}" text-anchor="middle" dominant-baseline="middle" fill="${MUTED}" font-size="11" font-weight="500">${esc(edge.label)}</text>
            </g>`;
          })()
        : "";
      return `<path d="${esc(edge.d)}" fill="none" stroke="${look.stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#${look.marker})"${dash} />${label}`;
    })
    .join("");

  const nodes = used.nodes
    .map((node) => {
      const style = fillOf(node.kind);
      const inset = style.strokeWidth / 2;
      const rx = Math.max(0, cornerRadius(node.kind, node.w, node.h) - inset);
      const badge = node.badge
        ? (() => {
            const bw = Math.max(22, node.badge.length * 6.6 + 12);
            const bh = 16;
            const bx = node.x + node.w + 8 - bw;
            const by = node.y - 8;
            return `<g>
            <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="8" fill="${TEAL}" />
            <text class="sans" x="${bx + bw / 2}" y="${by + bh / 2}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="10" font-weight="700">${esc(node.badge)}</text>
          </g>`;
          })()
        : "";
      return `<g>
        <rect x="${node.x + inset}" y="${node.y + inset}" width="${Math.max(0, node.w - style.strokeWidth)}" height="${Math.max(0, node.h - style.strokeWidth)}" rx="${rx}" ry="${rx}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${style.strokeWidth}" filter="url(#nodeShadow)" />
        ${nodeText(node)}
        ${badge}
      </g>`;
    })
    .join("");

  const notes = used.notes
    .map((item) => {
      const lines = wrapLines(item.note, Math.max(12, Math.floor((item.w - 24) / 6.8)));
      const lineH = 16.8;
      const text = lines
        .map(
          (line, index) =>
            `<text class="sans" x="${item.x + 12}" y="${item.y + 12 + index * lineH}" dominant-baseline="hanging" fill="#5a4e32" font-size="12">${esc(line)}</text>`,
        )
        .join("");
      return `<g>
          <rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="2" fill="#fff7bf" stroke="#e0c86a" stroke-width="1" />
          ${text}
        </g>`;
    })
    .join("");

  const title = titleLines
    .map(
      (line, index) =>
        `<text class="serif" x="20" y="${52 + index * 34}" fill="${INK}" font-size="28" font-weight="400" letter-spacing="-0.56">${esc(line)}</text>`,
    )
    .join("");

  const extraCss = fonts.extraCss?.replaceAll("]]>", "]]]]><![CDATA[>") ?? "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(diagram.title)}">
  <title>${esc(diagram.title)}</title>
  <style type="text/css"><![CDATA[
    ${extraCss}
    .sans { font-family: ${fonts.sans}; }
    .serif { font-family: ${fonts.serif}; }
  ]]></style>
  <defs>
    <pattern id="dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="1.4" cy="1.4" r="1.4" fill="rgba(196,196,196,0.45)" />
    </pattern>
    <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="rgb(40,30,10)" flood-opacity="0.06" />
    </filter>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${EDGE}" />
    </marker>
    <marker id="arrow-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${TEAL}" />
    </marker>
    <marker id="arrow-clay" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${CLAY}" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="${CARD}" />
  <text class="sans" x="20" y="24" fill="${TEAL}" font-size="11" font-weight="500" letter-spacing="1.76">${esc(eyebrow)}</text>
  ${title}
  <g transform="translate(${padX}, ${headerH})">
    <rect x="0" y="0" width="${used.width}" height="${used.height}" fill="url(#dots)" />
    ${groups}
    ${edges}
    ${nodes}
    ${notes}
  </g>
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

export async function downloadPngFile(filename: string, diagram: Diagram, scene?: DiagramScene) {
  const svg = diagramToSvg(diagram, await themeForRaster(), scene);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No se pudo rasterizar el SVG."));
      img.src = url;
    });
    const sourceW = Math.max(1, image.naturalWidth || image.width);
    const sourceH = Math.max(1, image.naturalHeight || image.height);
    const max = 8192;
    const scale = Math.min(2.5, max / sourceW, max / sourceH);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceW * scale));
    canvas.height = Math.max(1, Math.round(sourceH * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear el lienzo PNG.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = CARD;
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
