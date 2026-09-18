import type { Diagram, DiagramEdge, DiagramNode, NodeKind, Side } from "./schema";
import { applyNodePositions, freezeLayout, NODE_SIZE } from "./layout";

export { applyNodePositions, freezeLayout };

function nextPrefixedId(prefix: string, used: string[]) {
  let i = 1;
  while (used.includes(`${prefix}${i}`)) i += 1;
  return `${prefix}${i}`;
}

export function nextNodeId(diagram: Diagram) {
  return nextPrefixedId("n", diagram.nodes.map((node) => node.id));
}

export function nextEdgeId(diagram: Diagram) {
  return nextPrefixedId("e", diagram.edges.map((edge) => edge.id));
}

export function patchNode(
  diagram: Diagram,
  nodeId: string,
  patch: Partial<DiagramNode>,
): Diagram {
  const frozen = freezeLayout(diagram);
  return {
    ...frozen,
    nodes: frozen.nodes.map((node) =>
      node.id === nodeId ? { ...node, ...patch, id: node.id } : node,
    ),
  };
}

export function patchEdge(
  diagram: Diagram,
  edgeId: string,
  patch: Partial<DiagramEdge>,
): Diagram {
  return {
    ...diagram,
    edges: diagram.edges.map((edge) =>
      edge.id === edgeId ? { ...edge, ...patch, id: edge.id } : edge,
    ),
  };
}

export function deleteNodes(diagram: Diagram, ids: string[]): Diagram {
  const frozen = freezeLayout(diagram);
  const remove = new Set(ids);
  return {
    ...frozen,
    nodes: frozen.nodes.filter((node) => !remove.has(node.id)),
    edges: frozen.edges.filter(
      (edge) => !remove.has(edge.source) && !remove.has(edge.target),
    ),
  };
}

export function deleteEdges(diagram: Diagram, ids: string[]): Diagram {
  const remove = new Set(ids);
  return {
    ...diagram,
    edges: diagram.edges.filter((edge) => !remove.has(edge.id)),
  };
}

export function addNode(
  diagram: Diagram,
  options?: { kind?: NodeKind; x?: number; y?: number; label?: string },
): { diagram: Diagram; id: string } {
  const frozen = freezeLayout(diagram);
  const id = nextNodeId(frozen);
  const kind = options?.kind ?? "process";
  const size = NODE_SIZE[kind];
  const last = frozen.nodes[frozen.nodes.length - 1];
  const node: DiagramNode = {
    id,
    label: options?.label ?? "Nuevo recuadro",
    kind,
    px: options?.x ?? (last?.px ?? 80) + 36,
    py: options?.y ?? (last?.py ?? 80) + 36,
    w: size.w,
    h: size.h,
  };
  return { diagram: { ...frozen, nodes: [...frozen.nodes, node] }, id };
}

export function duplicateNode(
  diagram: Diagram,
  nodeId: string,
): { diagram: Diagram; id: string } | null {
  const frozen = freezeLayout(diagram);
  const source = frozen.nodes.find((node) => node.id === nodeId);
  if (!source) return null;
  const id = nextNodeId(frozen);
  const copy: DiagramNode = {
    ...source,
    id,
    label: `${source.label} (copia)`,
    px: (source.px ?? 80) + 28,
    py: (source.py ?? 80) + 28,
  };
  return { diagram: { ...frozen, nodes: [...frozen.nodes, copy] }, id };
}

function sideFromHandle(handle?: string | null): Side | undefined {
  if (!handle) return undefined;
  if (handle.startsWith("t")) return "top";
  if (handle.startsWith("b")) return "bottom";
  if (handle.startsWith("l")) return "left";
  if (handle.startsWith("r")) return "right";
  return undefined;
}

export function connectNodes(
  diagram: Diagram,
  source: string,
  target: string,
  options?: { sourceHandle?: string | null; targetHandle?: string | null; label?: string },
): Diagram {
  if (!source || !target || source === target) return diagram;
  const exists = diagram.edges.some(
    (edge) => edge.source === source && edge.target === target,
  );
  if (exists) return diagram;
  const frozen = freezeLayout(diagram);
  if (!frozen.nodes.some((node) => node.id === source)) return frozen;
  if (!frozen.nodes.some((node) => node.id === target)) return frozen;
  const edge: DiagramEdge = {
    id: nextEdgeId(frozen),
    source,
    target,
    label: options?.label,
    fromSide: sideFromHandle(options?.sourceHandle),
    toSide: sideFromHandle(options?.targetHandle),
  };
  return { ...frozen, edges: [...frozen.edges, edge] };
}
