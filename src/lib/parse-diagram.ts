import {
  conversionSchema,
  diagramEdgeSchema,
  diagramNodeSchema,
  diagramSchema,
  groupSchema,
  type ConversionResult,
  type Diagram,
} from "./schema";
import { cleanConversion } from "./clean-diagram";

function stripTrailingCommas(text: string) {
  return text.replace(/,\s*(?=[}\]])/g, "");
}

function closeTruncatedJson(slice: string) {
  let text = slice.replace(/,\s*$/, "");
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  for (const ch of text) {
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  if (inString) text += '"';
  while (stack.length) text += stack.pop();
  return text;
}

function tryParseJson(text: string): unknown | null {
  const candidates = [text, stripTrailingCommas(text), closeTruncatedJson(stripTrailingCommas(text))];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      /* try next */
    }
  }
  return null;
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.search(/[[{]/);
  if (start < 0) return null;
  const slice = raw.slice(start);
  return tryParseJson(slice);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function coerceNode(raw: unknown) {
  const node = asRecord(raw);
  if (!node) return raw;
  return {
    ...node,
    id: node.id == null ? "" : String(node.id),
    label: String(node.label ?? node.name ?? node.text ?? node.title ?? ""),
    kind: node.kind == null ? "process" : String(node.kind),
    groupId: node.groupId == null ? undefined : String(node.groupId),
    col: node.col ?? node.column ?? node.columna,
    row: node.row ?? node.fila,
  };
}

function coerceEdge(raw: unknown) {
  const edge = asRecord(raw);
  if (!edge) return raw;
  return {
    ...edge,
    id: edge.id == null ? "" : String(edge.id),
    source: String(edge.source ?? edge.from ?? ""),
    target: String(edge.target ?? edge.to ?? ""),
    label: edge.label == null ? undefined : String(edge.label),
    kind: edge.kind == null ? undefined : String(edge.kind),
    fromSide: edge.fromSide == null ? undefined : String(edge.fromSide),
    toSide: edge.toSide == null ? undefined : String(edge.toSide),
  };
}

function coerceDiagram(raw: unknown) {
  const diagram = asRecord(raw);
  if (!diagram) return raw;
  return {
    ...diagram,
    title: diagram.title == null ? "Diagrama" : String(diagram.title),
    type: diagram.type == null ? "flowchart" : String(diagram.type),
    direction: diagram.direction == null ? "LR" : String(diagram.direction),
    groups: Array.isArray(diagram.groups) ? diagram.groups : [],
    nodes: Array.isArray(diagram.nodes) ? diagram.nodes.map(coerceNode) : [],
    edges: Array.isArray(diagram.edges) ? diagram.edges.map(coerceEdge) : [],
    notes: Array.isArray(diagram.notes)
      ? diagram.notes.map((note) => String(note))
      : undefined,
  };
}

function salvageDiagram(raw: unknown): Diagram | null {
  const coerced = coerceDiagram(raw);
  const direct = diagramSchema.safeParse(coerced);
  if (direct.success) return direct.data;

  const record = asRecord(coerced);
  if (!record) return null;

  const nodes = (Array.isArray(record.nodes) ? record.nodes : [])
    .map((node) => diagramNodeSchema.safeParse(node))
    .flatMap((result) => (result.success ? [result.data] : []));
  if (!nodes.length) return null;

  const edges = (Array.isArray(record.edges) ? record.edges : [])
    .map((edge) => diagramEdgeSchema.safeParse(edge))
    .flatMap((result) => (result.success ? [result.data] : []));
  const groups = (Array.isArray(record.groups) ? record.groups : [])
    .map((group) => groupSchema.safeParse(group))
    .flatMap((result) => (result.success ? [result.data] : []));

  const fallback = diagramSchema.safeParse({
    title: record.title ?? "Diagrama",
    subtitle: record.subtitle,
    type: record.type ?? "flowchart",
    direction: record.direction ?? "LR",
    groups,
    nodes,
    edges,
    notes: record.notes,
  });
  return fallback.success ? fallback.data : null;
}

function diagramList(payload: unknown): unknown[] {
  const root = asRecord(payload);
  if (root && Array.isArray(root.diagrams)) return root.diagrams;
  if (root && Array.isArray(root.nodes)) return [root];
  if (Array.isArray(payload)) return payload;
  return [];
}

export function parseConversion(payload: unknown): ConversionResult | null {
  const diagramsRaw = diagramList(payload).map(coerceDiagram);
  const wrapped = diagramsRaw.length ? { diagrams: diagramsRaw } : payload;

  const direct = conversionSchema.safeParse(wrapped);
  if (direct.success) return cleanConversion(direct.data);

  const salvaged = diagramsRaw
    .map(salvageDiagram)
    .filter((diagram): diagram is Diagram => Boolean(diagram));
  if (!salvaged.length) return null;
  return cleanConversion({ diagrams: salvaged });
}

function scoreResult(result: ConversionResult | null) {
  if (!result?.diagrams.length) return -1;
  return result.diagrams.reduce((sum, diagram) => {
    const placed = diagram.nodes.filter(
      (node) =>
        node.col != null ||
        node.row != null ||
        (node.x != null && node.y != null),
    ).length;
    return sum + diagram.nodes.length * 4 + diagram.edges.length * 2 + placed;
  }, 0);
}

export function pickConversion(
  ...candidates: Array<ConversionResult | null | undefined>
) {
  let best: ConversionResult | null = null;
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = scoreResult(candidate ?? null);
    if (score > bestScore) {
      best = candidate ?? null;
      bestScore = score;
    }
  }
  return best;
}

function toNum(value: string | undefined) {
  if (value == null || value === "") return undefined;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export function parseInventoryText(text: string): ConversionResult | null {
  const nodes: Array<Record<string, unknown>> = [];
  const edges: Array<Record<string, unknown>> = [];
  const groups: Array<Record<string, unknown>> = [];
  const notes: string[] = [];
  let title = "Diagrama";
  let subtitle: string | undefined;
  let type = "flowchart";
  let direction = "LR";
  let gridCols = 16;
  let gridRows = 10;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^[-*>•]\s*/, "");
    if (!line || line.startsWith("#") || line.startsWith("```")) continue;
    const parts = line.split("|").map((part) => part.trim());
    const key = parts[0]?.toUpperCase().replace(/:$/, "");
    if (!key) continue;

    if (key === "TITLE" || key === "TITULO" || key === "TÍTULO") {
      title = parts.slice(1).join(" | ") || title;
    } else if (key === "SUBTITLE" || key === "SUBTITULO" || key === "SUBTÍTULO") {
      subtitle = parts.slice(1).join(" | ") || undefined;
    } else if (key === "TYPE" || key === "TIPO") {
      type = parts[1] || type;
    } else if (key === "DIR" || key === "DIRECTION" || key === "DIRECCION") {
      direction = parts[1] || direction;
    } else if (key === "GRID") {
      gridCols = toNum(parts[1]) || gridCols;
      gridRows = toNum(parts[2]) || gridRows;
    } else if (key === "NODE" || key === "N" || key === "BOX") {
      const id = parts[1];
      const label = parts.slice(5).join(" | ");
      if (!id || !label) continue;
      if (/^id$/i.test(id) || /texto exacto del recuadro/i.test(label)) continue;
      const col = toNum(parts[2]);
      const row = toNum(parts[3]);
      nodes.push({
        id,
        col,
        row,
        kind: parts[4] || "process",
        label,
        x: col == null ? undefined : ((col + 0.5) / gridCols) * 100,
        y: row == null ? undefined : ((row + 0.5) / gridRows) * 100,
      });
    } else if (key === "GROUP" || key === "G" || key === "LANE") {
      const id = parts[1];
      if (!id) continue;
      groups.push({
        id,
        col: toNum(parts[2]),
        row: toNum(parts[3]),
        w: toNum(parts[4]),
        h: toNum(parts[5]),
        label: parts.slice(6).join(" | "),
      });
    } else if (key === "EDGE" || key === "E" || key === "ARROW") {
      const source = parts[1];
      const target = parts[2];
      if (!source || !target) continue;
      edges.push({
        id: `e${edges.length + 1}`,
        source,
        target,
        label: parts[3] || undefined,
        fromSide: parts[4] || undefined,
        toSide: parts[5] || undefined,
      });
    } else if (key === "NOTE" || key === "NOTA") {
      const note = parts.slice(1).join(" | ");
      if (note) notes.push(note);
    }
  }

  if (!nodes.length) return null;
  return parseConversion({
    diagrams: [{ title, subtitle, type, direction, groups, nodes, edges, notes }],
  });
}

export function parseConversionText(text: string): ConversionResult | null {
  if (!text.trim()) return null;
  const json = extractJson(text);
  return pickConversion(
    json ? parseConversion(json) : null,
    parseInventoryText(text),
  );
}
