import type { Diagram, DiagramEdge, DiagramNode, NodeKind } from "./schema";

export type FlowGraph = {
  outgoing: Map<string, string[]>;
  incoming: Map<string, string[]>;
  edgesFrom: Map<string, DiagramEdge[]>;
  edgesTo: Map<string, DiagramEdge[]>;
};

export type PathHighlight = {
  focus: string;
  upstream: Set<string>;
  downstream: Set<string>;
  nodes: Set<string>;
  edges: Set<string>;
};

export type PresentationStep = {
  nodeId: string;
  incomingEdgeIds: string[];
  label: string;
  description?: string;
  kind: NodeKind;
  badge?: string;
};

const EDGE_KIND_RANK: Record<string, number> = {
  success: 0,
  default: 1,
  warning: 2,
  dashed: 3,
};

export function buildFlowGraph(diagram: Diagram): FlowGraph {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  const edgesFrom = new Map<string, DiagramEdge[]>();
  const edgesTo = new Map<string, DiagramEdge[]>();

  for (const node of diagram.nodes) {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
    edgesFrom.set(node.id, []);
    edgesTo.set(node.id, []);
  }

  for (const edge of diagram.edges) {
    if (!outgoing.has(edge.source) || !incoming.has(edge.target)) continue;
    outgoing.get(edge.source)!.push(edge.target);
    incoming.get(edge.target)!.push(edge.source);
    edgesFrom.get(edge.source)!.push(edge);
    edgesTo.get(edge.target)!.push(edge);
  }

  return { outgoing, incoming, edgesFrom, edgesTo };
}

function walk(
  start: string,
  next: Map<string, string[]>,
): Set<string> {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const id = stack.pop()!;
    for (const neighbor of next.get(id) ?? []) {
      if (seen.has(neighbor)) continue;
      seen.add(neighbor);
      stack.push(neighbor);
    }
  }
  return seen;
}

export function pathFromNode(diagram: Diagram, nodeId: string): PathHighlight | null {
  if (!diagram.nodes.some((node) => node.id === nodeId)) return null;
  const graph = buildFlowGraph(diagram);
  const upstream = walk(nodeId, graph.incoming);
  const downstream = walk(nodeId, graph.outgoing);
  const nodes = new Set<string>([nodeId, ...upstream, ...downstream]);
  const edges = new Set<string>();

  for (const edge of diagram.edges) {
    if (nodes.has(edge.source) && nodes.has(edge.target)) {
      const climbs = upstream.has(edge.source) && (upstream.has(edge.target) || edge.target === nodeId);
      const drops = downstream.has(edge.target) && (downstream.has(edge.source) || edge.source === nodeId);
      const throughFocus = edge.source === nodeId || edge.target === nodeId;
      if (climbs || drops || throughFocus) edges.add(edge.id);
    }
  }

  return { focus: nodeId, upstream, downstream, nodes, edges };
}

function nodeIndex(diagram: Diagram) {
  return new Map(diagram.nodes.map((node, index) => [node.id, index]));
}

function edgeRank(edge: DiagramEdge) {
  return EDGE_KIND_RANK[edge.kind ?? "default"] ?? 1;
}

function seeds(diagram: Diagram, graph: FlowGraph): DiagramNode[] {
  const starts = diagram.nodes.filter((node) => node.kind === "start");
  if (starts.length) return starts;
  const roots = diagram.nodes.filter((node) => (graph.incoming.get(node.id)?.length ?? 0) === 0);
  if (roots.length) return roots;
  return diagram.nodes.slice(0, 1);
}

export function presentationSteps(diagram: Diagram): PresentationStep[] {
  if (!diagram.nodes.length) return [];

  const graph = buildFlowGraph(diagram);
  const order = nodeIndex(diagram);
  const visited = new Set<string>();
  const sequence: string[] = [];

  const visit = (id: string) => {
    if (visited.has(id) || !order.has(id)) return;
    visited.add(id);
    sequence.push(id);
    const outgoing = [...(graph.edgesFrom.get(id) ?? [])].sort((a, b) => {
      const rank = edgeRank(a) - edgeRank(b);
      if (rank !== 0) return rank;
      return (order.get(a.target) ?? 0) - (order.get(b.target) ?? 0);
    });
    for (const edge of outgoing) visit(edge.target);
  };

  for (const seed of seeds(diagram, graph)) visit(seed.id);
  for (const node of diagram.nodes) visit(node.id);

  return sequence.map((nodeId) => {
    const node = diagram.nodes.find((item) => item.id === nodeId)!;
    const already = new Set(sequence.slice(0, sequence.indexOf(nodeId)));
    const incomingEdgeIds = (graph.edgesTo.get(nodeId) ?? [])
      .filter((edge) => already.has(edge.source))
      .map((edge) => edge.id);
    return {
      nodeId,
      incomingEdgeIds,
      label: node.label,
      description: node.description,
      kind: node.kind,
      badge: node.badge,
    };
  });
}

export function revealedAt(steps: PresentationStep[], index: number) {
  const safe = Math.max(-1, Math.min(index, steps.length - 1));
  const revealedNodes = new Set<string>();
  const revealedEdges = new Set<string>();
  for (let i = 0; i <= safe; i += 1) {
    const step = steps[i];
    revealedNodes.add(step.nodeId);
    for (const edgeId of step.incomingEdgeIds) revealedEdges.add(edgeId);
  }
  const current = safe >= 0 ? steps[safe] : undefined;
  return { revealedNodes, revealedEdges, current };
}
