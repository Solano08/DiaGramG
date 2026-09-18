import { routeEdgeSet, staggerT, type Side } from "./geometry";
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
    const mid = { ...routed.mid };
    for (const other of placedLabels) {
      if (Math.hypot(other.x - mid.x, other.y - mid.y) < 24) mid.y += 18;
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
