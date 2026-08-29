import { z } from "zod";

const NODE_KINDS = [
  "start",
  "end",
  "process",
  "decision",
  "data",
  "actor",
  "system",
  "io",
  "note",
  "document",
] as const;

const DIAGRAM_TYPES = [
  "flowchart",
  "swimlane",
  "org",
  "architecture",
  "mindmap",
  "network",
  "sequence",
  "other",
] as const;

const DIRECTIONS = ["TB", "LR", "BT", "RL"] as const;
const EDGE_KINDS = ["default", "success", "warning", "dashed"] as const;
const SIDES = ["left", "right", "top", "bottom"] as const;

function looseEnum<T extends string>(values: readonly T[], fallback: T) {
  return z.string().transform((raw) => {
    const normalized = raw.trim().toLowerCase().replaceAll(/\s+/g, "");
    const match = values.find((value) => value.toLowerCase() === normalized);
    return (match ?? fallback) as T;
  });
}

export const nodeKindSchema = looseEnum(NODE_KINDS, "process");
export const diagramTypeSchema = looseEnum(DIAGRAM_TYPES, "flowchart");
export const directionSchema = z.string().transform((raw) => {
  const value = raw.trim().toUpperCase();
  if (DIRECTIONS.includes(value as (typeof DIRECTIONS)[number])) {
    return value as (typeof DIRECTIONS)[number];
  }
  if (/LR|LEFT|DERECHA|HORIZONTAL|EAST/i.test(raw)) return "LR";
  if (/RL|LEFTWARD|IZQUIERDA/i.test(raw)) return "RL";
  if (/BT|UP|ARRIBA/i.test(raw)) return "BT";
  return "TB";
});

const percent = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value == null || value === "") return undefined;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return undefined;
    return Math.min(100, Math.max(0, n));
  });

const gridIndex = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value == null || value === "") return undefined;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return undefined;
    return Math.round(Math.min(48, Math.max(0, n)));
  });

export const groupSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((value) => String(value).trim()),
  label: z.union([z.string(), z.number()]).transform((value) => String(value)),
  description: z.string().nullish().transform((v) => v ?? undefined),
  x: percent,
  y: percent,
  w: percent,
  h: percent,
  col: gridIndex,
  row: gridIndex,
});

const textId = z.union([z.string(), z.number()]).transform((value) => String(value).trim());

export const diagramNodeSchema = z.object({
  id: textId,
  label: textId,
  description: z.string().nullish().transform((v) => v ?? undefined),
  kind: nodeKindSchema.catch("process"),
  groupId: z.string().nullish().transform((v) => v ?? undefined),
  badge: z.string().nullish().transform((v) => v ?? undefined),
  x: percent,
  y: percent,
  w: percent,
  h: percent,
  col: gridIndex,
  row: gridIndex,
});

export const diagramEdgeSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((value) => String(value).trim()),
  source: z.union([z.string(), z.number()]).transform((value) => String(value).trim()),
  target: z.union([z.string(), z.number()]).transform((value) => String(value).trim()),
  label: z.string().nullish().transform((v) => v ?? undefined),
  kind: z
    .string()
    .nullish()
    .transform((raw) => {
      if (!raw) return undefined;
      const normalized = raw.trim().toLowerCase();
      return EDGE_KINDS.includes(normalized as (typeof EDGE_KINDS)[number])
        ? (normalized as (typeof EDGE_KINDS)[number])
        : "default";
    }),
  fromSide: z
    .string()
    .nullish()
    .transform((raw) => {
      if (!raw) return undefined;
      return SIDES.includes(raw.trim().toLowerCase() as (typeof SIDES)[number])
        ? (raw.trim().toLowerCase() as (typeof SIDES)[number])
        : undefined;
    }),
  toSide: z
    .string()
    .nullish()
    .transform((raw) => {
      if (!raw) return undefined;
      return SIDES.includes(raw.trim().toLowerCase() as (typeof SIDES)[number])
        ? (raw.trim().toLowerCase() as (typeof SIDES)[number])
        : undefined;
    }),
});

export const diagramSchema = z.object({
  title: z.union([z.string(), z.number()]).transform(String).catch("Diagrama"),
  subtitle: z.string().nullish().transform((v) => v ?? undefined),
  type: diagramTypeSchema.catch("flowchart"),
  direction: directionSchema.catch("LR"),
  groups: z.array(groupSchema).catch([]),
  nodes: z.array(diagramNodeSchema),
  edges: z.array(diagramEdgeSchema).catch([]),
  notes: z
    .array(z.union([z.string(), z.number()]).transform(String))
    .nullish()
    .transform((v) => v ?? undefined),
});

export const conversionSchema = z.object({
  diagrams: z.array(diagramSchema).min(1),
});

export type NodeKind = (typeof NODE_KINDS)[number];
export type DiagramType = (typeof DIAGRAM_TYPES)[number];
export type Direction = (typeof DIRECTIONS)[number];
export type Side = (typeof SIDES)[number];
export type DiagramGroup = {
  id: string;
  label: string;
  description?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  col?: number;
  row?: number;
};
export type DiagramNode = {
  id: string;
  label: string;
  description?: string;
  kind: NodeKind;
  groupId?: string;
  badge?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  col?: number;
  row?: number;
};
export type DiagramEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind?: (typeof EDGE_KINDS)[number];
  fromSide?: Side;
  toSide?: Side;
};
export type Diagram = {
  title: string;
  subtitle?: string;
  type: DiagramType;
  direction: Direction;
  groups: DiagramGroup[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  notes?: string[];
};
export type ConversionResult = {
  diagrams: Diagram[];
};

export const conversionModelSchema = z.object({
  diagrams: z
    .array(
      z.object({
        title: z.string(),
        subtitle: z.string().optional(),
        type: z.string(),
        direction: z.string(),
        groups: z
          .array(
            z.object({
              id: z.union([z.string(), z.number()]),
              label: z.string(),
              description: z.string().optional(),
              x: z.number().optional(),
              y: z.number().optional(),
              w: z.number().optional(),
              h: z.number().optional(),
              col: z.number().optional(),
              row: z.number().optional(),
            }),
          )
          .optional(),
        nodes: z.array(
          z.object({
            id: z.union([z.string(), z.number()]),
            label: z.string(),
            description: z.string().optional(),
            kind: z.string(),
            groupId: z.string().optional(),
            badge: z.string().optional(),
            x: z.number().optional(),
            y: z.number().optional(),
            w: z.number().optional(),
            h: z.number().optional(),
            col: z.number().optional(),
            row: z.number().optional(),
          }),
        ),
        edges: z
          .array(
            z.object({
              id: z.union([z.string(), z.number()]),
              source: z.union([z.string(), z.number()]),
              target: z.union([z.string(), z.number()]),
              label: z.string().optional(),
              kind: z.string().optional(),
              fromSide: z.string().optional(),
              toSide: z.string().optional(),
            }),
          )
          .optional(),
        notes: z.array(z.string()).optional(),
      }),
    )
    .min(1),
});
