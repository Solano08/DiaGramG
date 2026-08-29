import type { Edge, Node } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import { pickHandles } from "./geometry";
import type { Diagram, Direction, NodeKind } from "./schema";
import { absNodeBoxes, layoutDiagram, nodeMap, type LaidOut } from "./layout";

export type FlowData = {
  label: string;
  description?: string;
  kind: NodeKind | "lane";
  badge?: string;
  direction: Direction;
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

  const edges: FlowEdge[] = diagram.edges
    .filter((edge) => meta.has(edge.source) && meta.has(edge.target))
    .map((edge) => {
      const from = abs.get(edge.source);
      const to = abs.get(edge.target);
      const handles =
        from && to
          ? pickHandles(from, to, edge.fromSide, edge.toSide)
          : { sourceHandle: "r-out", targetHandle: "l-in" };
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        type: "step" as const,
        pathOptions: { borderRadius: 0, offset: 20 },
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
