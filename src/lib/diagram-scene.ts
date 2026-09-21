import {
  edgeLabelPoint,
  routeEdgeSet,
  staggerT,
  type Pt,
  type Rect,
  type Side,
} from "./geometry";
import { absNodeBoxes, layoutDiagram } from "./layout";
import type { Diagram, NodeKind } from "./schema";

export type SceneNode = {
  id: string;
  label: string;
  kind: NodeKind;
  badge?: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SceneEdge = {
  id: string;
  source: string;
  target: string;
  d: string;
  label?: string;
  kind: string;
  mid: { x: number; y: number };
};

export type SceneNote = {
  note: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type DiagramScene = {
  width: number;
  height: number;
  title: string;
  subtitle?: string;
  groups: { id: string; label: string; x: number; y: number; w: number; h: number }[];
  nodes: SceneNode[];
  notes: SceneNote[];
  edges: SceneEdge[];
};

export function sceneFromDiagram(diagram: Diagram): DiagramScene {
  const laid = layoutDiagram(diagram);
  const abs = absNodeBoxes(laid);
  const absMap = new Map(abs.map((box) => [box.id, box]));
  const meta = new Map(diagram.nodes.map((node) => [node.id, node]));

  const maxNodeRight = Math.max(...abs.map((box) => box.x + box.w), 640);
  const notes = (diagram.notes ?? []).map((note, index) => {
    const w = 200;
    const h = Math.min(140, 48 + Math.ceil(note.length / 28) * 16);
    return {
      note,
      x: maxNodeRight + 36,
      y: 48 + index * (h + 16),
      w,
      h,
    };
  });

  const width = Math.max(
    laid.width,
    ...notes.map((item) => item.x + item.w + 24),
    960,
  );
  const height = Math.max(
    laid.height,
    ...notes.map((item) => item.y + item.h + 24),
    640,
  );

  const buckets = new Map<string, number>();
  const counts = new Map<string, number>();
  const usable = diagram.edges.filter(
    (edge) => absMap.has(edge.source) && absMap.has(edge.target),
  );
  for (const edge of usable) {
    const key = `${edge.source}->${edge.target}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const routedMap = routeEdgeSet(
    abs,
    usable.map((edge) => {
      const pair = `${edge.source}->${edge.target}`;
      const total = counts.get(pair) ?? 1;
      const index = buckets.get(pair) ?? 0;
      buckets.set(pair, index + 1);
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceSide: edge.fromSide as Side | undefined,
        targetSide: edge.toSide as Side | undefined,
        startT: staggerT(index, total),
      };
    }),
  );

  const placedLabels: Array<{ x: number; y: number }> = [];
  const edges: SceneEdge[] = usable.flatMap((edge) => {
    const routed = routedMap.get(edge.id);
    if (!routed) return [];
    const mid = { ...edgeLabelPoint(routed, edge.labelT) };
    if (edge.labelT == null) {
      for (const other of placedLabels) {
        if (Math.hypot(other.x - mid.x, other.y - mid.y) < 24) mid.y += 18;
      }
    }
    placedLabels.push(mid);
    return [
      {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        d: routed.d,
        label: edge.label,
        kind: edge.kind === "dashed" ? "dash" : edge.kind ?? "default",
        mid,
      },
    ];
  });

  return {
    width,
    height,
    title: diagram.title,
    subtitle: diagram.subtitle,
    groups: laid.groups,
    nodes: abs.flatMap((box) => {
      const node = meta.get(box.id);
      if (!node) return [];
      return [
        {
          id: node.id,
          label: node.label,
          kind: node.kind,
          badge: node.badge,
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
        },
      ];
    }),
    notes,
    edges,
  };
}

export type LiveFlowNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
  width?: number;
  height?: number;
  style?: { width?: unknown; height?: unknown };
  data?: { label?: unknown; kind?: unknown; badge?: unknown };
};

function cssSize(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function pointsFromD(d: string): Pt[] {
  const pts: Pt[] = [];
  for (const match of d.matchAll(/[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/gi)) {
    pts.push({ x: Number(match[1]), y: Number(match[2]) });
  }
  return pts;
}

function midOf(points: Pt[]): Pt {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };
  let best = 1;
  let bestLen = -1;
  const last = points.length - 1;
  for (let i = 1; i < points.length; i += 1) {
    const len =
      Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
    const score = len * (i === 1 || i === last ? 0.72 : 1);
    if (score > bestLen) {
      bestLen = score;
      best = i;
    }
  }
  const a = points[best - 1];
  const b = points[best];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function readLiveEdgePaths() {
  const paths = new Map<string, string>();
  if (typeof document === "undefined") return paths;
  for (const edge of document.querySelectorAll(".react-flow__edge")) {
    const id = edge.getAttribute("data-id");
    const d = edge.querySelector("path.react-flow__edge-path")?.getAttribute("d");
    if (id && d) paths.set(id, d);
  }
  return paths;
}

export function sceneFromLive(
  diagram: Diagram,
  flowNodes: LiveFlowNode[],
  livePaths?: Map<string, string>,
): DiagramScene {
  const meta = new Map(diagram.nodes.map((node) => [node.id, node]));
  const groups: DiagramScene["groups"] = [];
  const rects: Rect[] = [];
  const nodes: SceneNode[] = [];

  for (const node of flowNodes) {
    const w = node.measured?.width ?? node.width ?? cssSize(node.style?.width, 0);
    const h = node.measured?.height ?? node.height ?? cssSize(node.style?.height, 0);
    if (!w || !h) continue;
    if (node.type === "lane") {
      groups.push({
        id: node.id.replace(/^lane:/, ""),
        label: String(node.data?.label ?? ""),
        x: node.position.x,
        y: node.position.y,
        w,
        h,
      });
      continue;
    }
    const info = meta.get(node.id);
    if (!info) continue;
    rects.push({ id: node.id, x: node.position.x, y: node.position.y, w, h });
    nodes.push({
      id: info.id,
      label: info.label,
      kind: info.kind,
      badge: info.badge,
      x: node.position.x,
      y: node.position.y,
      w,
      h,
    });
  }

  const rectMap = new Map(rects.map((box) => [box.id, box]));
  const buckets = new Map<string, number>();
  const counts = new Map<string, number>();
  const usable = diagram.edges.filter(
    (edge) => rectMap.has(edge.source) && rectMap.has(edge.target),
  );
  for (const edge of usable) {
    const key = `${edge.source}->${edge.target}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const routedMap = routeEdgeSet(
    rects,
    usable.map((edge) => {
      const pair = `${edge.source}->${edge.target}`;
      const total = counts.get(pair) ?? 1;
      const index = buckets.get(pair) ?? 0;
      buckets.set(pair, index + 1);
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceSide: edge.fromSide as Side | undefined,
        targetSide: edge.toSide as Side | undefined,
        startT: staggerT(index, total),
      };
    }),
  );

  const placedLabels: Array<{ x: number; y: number }> = [];
  const edges: SceneEdge[] = usable.flatMap((edge) => {
    const liveD = livePaths?.get(edge.id);
    const routed = routedMap.get(edge.id);
    const d = liveD ?? routed?.d;
    if (!d) return [];
    const points = liveD ? pointsFromD(liveD) : (routed?.points ?? pointsFromD(d));
    const fallbackMid = points.length ? midOf(points) : (routed?.mid ?? { x: 0, y: 0 });
    const mid = { ...edgeLabelPoint({ points, mid: fallbackMid }, edge.labelT) };
    if (edge.labelT == null) {
      for (const other of placedLabels) {
        if (Math.hypot(other.x - mid.x, other.y - mid.y) < 24) mid.y += 18;
      }
    }
    placedLabels.push(mid);
    return [
      {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        d,
        label: edge.label,
        kind: edge.kind === "dashed" ? "dash" : edge.kind ?? "default",
        mid,
      },
    ];
  });

  const bounds = { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 };
  const include = (x: number, y: number, w = 0, h = 0) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x + w);
    bounds.maxY = Math.max(bounds.maxY, y + h);
  };
  for (const group of groups) include(group.x, group.y, group.w, group.h);
  for (const node of nodes) include(node.x, node.y, node.w, node.h);
  for (const edge of edges) {
    for (const point of pointsFromD(edge.d)) include(point.x, point.y);
  }
  if (!Number.isFinite(bounds.minX)) {
    bounds.minX = 0;
    bounds.minY = 0;
    bounds.maxX = 960;
    bounds.maxY = 640;
  }

  return {
    width: Math.max(bounds.maxX + 48, 320),
    height: Math.max(bounds.maxY + 48, 240),
    title: diagram.title,
    subtitle: diagram.subtitle,
    groups,
    nodes,
    notes: [],
    edges,
  };
}
