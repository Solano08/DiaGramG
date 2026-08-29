import type { ConversionResult, Diagram, DiagramEdge, DiagramNode } from "./schema";

function uniqueId(base: string, used: Set<string>) {
  const seed = base.trim() || "id";
  if (!used.has(seed)) {
    used.add(seed);
    return seed;
  }
  let i = 2;
  while (used.has(`${seed}_${i}`)) i += 1;
  const next = `${seed}_${i}`;
  used.add(next);
  return next;
}

function tidy(value: string) {
  return value.replaceAll(/\s+/g, " ").trim();
}

function inferKind(node: DiagramNode): DiagramNode["kind"] {
  if (node.kind !== "process") return node.kind;
  const label = node.label;
  if (/[¿?]/u.test(label)) return "decision";
  if (/^(inicio|start|begin)$/i.test(label)) return "start";
  if (/^(fin|end|cierre)$/i.test(label)) return "end";
  return node.kind;
}

function inferEdgeKind(edge: DiagramEdge): DiagramEdge["kind"] {
  if (edge.kind && edge.kind !== "default") return edge.kind;
  const label = (edge.label ?? "").trim().toLowerCase();
  if (/^(sí|si|yes|ok|aplica|s[ií] aplica)$/i.test(label)) return "success";
  if (/^(no|no aplica)$/i.test(label)) return "warning";
  return edge.kind;
}

function fillCoords(nodes: DiagramNode[]) {
  const cols = nodes.map((n) => n.col).filter((v): v is number => v != null);
  const rows = nodes.map((n) => n.row).filter((v): v is number => v != null);
  const maxCol = (cols.length ? Math.max(...cols) : 15) + 1;
  const maxRow = (rows.length ? Math.max(...rows) : 9) + 1;
  return nodes.map((node) => {
    let { col, row, x, y } = node;
    if (col == null && x != null) col = Math.round((x / 100) * Math.max(maxCol - 1, 1));
    if (row == null && y != null) row = Math.round((y / 100) * Math.max(maxRow - 1, 1));
    if (x == null && col != null) x = ((col + 0.5) / maxCol) * 100;
    if (y == null && row != null) y = ((row + 0.5) / maxRow) * 100;
    return { ...node, col, row, x, y };
  });
}

export function cleanDiagram(diagram: Diagram): Diagram {
  const usedNodes = new Set<string>();
  const idMap = new Map<string, string>();

  const nodes: DiagramNode[] = [];
  for (const node of fillCoords(diagram.nodes)) {
    const label = tidy(node.label ?? "");
    if (!label) continue;
    const id = uniqueId(node.id || `n${nodes.length + 1}`, usedNodes);
    idMap.set(node.id, id);
    idMap.set(tidy(node.id), id);
    nodes.push({
      ...node,
      id,
      label,
      kind: inferKind({ ...node, label }),
      description: node.description ? tidy(node.description) : undefined,
    });
  }

  const valid = new Set(nodes.map((n) => n.id));
  const nodeLabels = new Set(nodes.map((n) => tidy(n.label).toLowerCase()));
  const usedEdges = new Set<string>();
  const seen = new Set<string>();
  const edges: DiagramEdge[] = [];
  for (const edge of diagram.edges) {
    const source = idMap.get(edge.source) ?? idMap.get(tidy(edge.source)) ?? edge.source;
    const target = idMap.get(edge.target) ?? idMap.get(tidy(edge.target)) ?? edge.target;
    if (!valid.has(source) || !valid.has(target) || source === target) continue;
    let label = edge.label ? tidy(edge.label) : undefined;
    if (label && nodeLabels.has(label.toLowerCase())) label = undefined;
    const key = `${source}>${target}>${label ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({
      ...edge,
      id: uniqueId(edge.id || `e${edges.length + 1}`, usedEdges),
      source,
      target,
      label,
      kind: inferEdgeKind({ ...edge, label }),
    });
  }

  const groups = diagram.groups
    .filter((group) => group.id)
    .map((group) => ({ ...group, label: tidy(group.label ?? "") }));
  const groupIds = new Set(groups.map((g) => g.id));

  return {
    ...diagram,
    title: tidy(diagram.title) || "Diagrama",
    subtitle: diagram.subtitle ? tidy(diagram.subtitle) : undefined,
    groups,
    nodes: nodes.map((node) => ({
      ...node,
      groupId: node.groupId && groupIds.has(node.groupId) ? node.groupId : undefined,
    })),
    edges,
    notes: diagram.notes?.map(tidy).filter(Boolean),
  };
}

export function cleanConversion(result: ConversionResult): ConversionResult | null {
  const diagrams = result.diagrams.map(cleanDiagram).filter((d) => d.nodes.length > 0);
  if (!diagrams.length) return null;
  return { diagrams };
}
