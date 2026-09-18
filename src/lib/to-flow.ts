import type { Edge, Node } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import { routeEdgeSet, staggerT, type Side } from "./geometry";
import type { Diagram, Direction, NodeKind } from "./schema";
import { absNodeBoxes, layoutDiagram, nodeMap, type LaidOut } from "./layout";

export type NodeEmphasis =
  | "idle"
  | "path-up"
  | "path-down"
  | "path-focus"
  | "dim"
  | "present-current"
  | "present-seen"
  | "present-hidden";

export type FlowData = {
  label: string;
  description?: string;
  kind: NodeKind | "lane";
  badge?: string;
  direction: Direction;
  emphasis?: NodeEmphasis;
};

export type FlowNode = Node<FlowData>;
export type FlowEdge = Edge;

export function toFlow(diagram: Diagram, laid?: LaidOut) {
  const layout = laid ?? layoutDiagram(diagram);
  const meta = nodeMap(diagram);
  const abs = new Map(absNodeBoxes(layout).map((box) => [box.id, box]));

  const nodes: FlowNode[] = layout.groups.map((group) => ({
    id: `lane:${group.id}`,
    type: "lane",
    position: { x: group.x, y: group.y },
    data: {
      label: group.label,
      kind: "lane" as const,
      direction: diagram.direction,
    },
    style: { width: group.w, height: group.h },
    selectable: false,
    draggable: false,
    connectable: false,
    zIndex: 0,
  }));

  for (const box of layout.nodes) {
    const node = meta.get(box.id);
    if (!node) continue;
    nodes.push({
      id: box.id,
      type: node.kind,
      position: { x: box.x, y: box.y },
      data: {
        label: node.label,
        description: node.description,
        kind: node.kind,
        badge: node.badge,
        direction: diagram.direction,
      },
      parentId: box.parentId ? `lane:${box.parentId}` : undefined,
      extent: box.parentId ? "parent" : undefined,
      style: { width: box.w, height: box.h },
      zIndex: 1,
    });
  }

  const buckets = new Map<string, number>();
  const counts = new Map<string, number>();
  const usable = diagram.edges.filter(
    (edge) => meta.has(edge.source) && meta.has(edge.target),
  );
  for (const edge of usable) {
    const key = `${edge.source}->${edge.target}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const routedMap = routeEdgeSet(
    [...abs.values()],
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

  const edges: FlowEdge[] = usable.map((edge) => {
    const routed = routedMap.get(edge.id) ?? {
      sourceHandle: "r-out",
      targetHandle: "l-in",
    };
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: routed.sourceHandle,
      targetHandle: routed.targetHandle,
      type: "routed" as const,
      data: {
        fromSide: edge.fromSide,
        toSide: edge.toSide,
      },
      label: edge.label,
      labelShowBg: true,
      labelBgStyle: { fill: "#f4efe6" },
      labelBgPadding: [7, 4] as [number, number],
      labelBgBorderRadius: 4,
      animated: edge.kind === "success",
      className: edge.kind ?? "default",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color:
          edge.kind === "success"
            ? "#0f6e5c"
            : edge.kind === "warning"
              ? "#c45c26"
              : "#5c564c",
      },
      style: {
        stroke:
          edge.kind === "success"
            ? "#0f6e5c"
            : edge.kind === "warning"
              ? "#c45c26"
              : "#8a8174",
        strokeWidth: 1.7,
        strokeDasharray: edge.kind === "dashed" ? "7 6" : undefined,
      },
    };
  });

  return { nodes, edges, layout };
}
