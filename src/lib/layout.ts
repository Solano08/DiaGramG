import dagre from "dagre";
import type { Diagram, DiagramNode, NodeKind } from "./schema";

export type Box = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  parentId?: string;
};

export type GroupBox = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type LaidOut = {
  width: number;
  height: number;
  nodes: Box[];
  groups: GroupBox[];
};

export const NODE_SIZE: Record<NodeKind, { w: number; h: number }> = {
  start: { w: 150, h: 52 },
  end: { w: 150, h: 52 },
  process: { w: 176, h: 72 },
  decision: { w: 168, h: 88 },
  data: { w: 168, h: 68 },
  actor: { w: 156, h: 70 },
  system: { w: 176, h: 76 },
  io: { w: 164, h: 66 },
  note: { w: 180, h: 78 },
  document: { w: 168, h: 74 },
};

function wrapLines(label: string, maxChars: number) {
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [label];
}

function sizeOf(node: DiagramNode) {
  const base = NODE_SIZE[node.kind];
  const maxChars = node.kind === "decision" ? 16 : 20;
  const lines = wrapLines(node.label, maxChars);
  const longest = Math.max(...lines.map((line) => line.length), 8);
  const w = Math.min(268, Math.max(base.w, 28 + longest * 7.4));
  const h = Math.min(128, Math.max(base.h, 22 + lines.length * 17));
  return { w, h };
}

function uniqueSorted(values: number[]) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function spread(values: number[]) {
  if (values.length < 2) return 0;
  return Math.max(...values) - Math.min(...values);
}

function canUseGrid(diagram: Diagram) {
  const located = diagram.nodes.filter(
    (node) => node.col != null && node.row != null,
  );
  if (located.length < Math.max(3, Math.ceil(diagram.nodes.length * 0.5))) {
    return false;
  }
  const cols = uniqueSorted(located.map((n) => n.col as number));
  const rows = uniqueSorted(located.map((n) => n.row as number));
  if (cols.length < 2) return false;
  if (located.length >= 7 && rows.length < 2) return false;
  return true;
}

function canUseSpatial(diagram: Diagram) {
  const located = diagram.nodes.filter(
    (n) => n.x != null && n.y != null && Number.isFinite(n.x) && Number.isFinite(n.y),
  );
  if (located.length < Math.max(3, Math.ceil(diagram.nodes.length * 0.55))) {
    return false;
  }
  const ys = located.map((n) => n.y as number);
  const xs = located.map((n) => n.x as number);
  if (located.length >= 7 && spread(ys) < 10 && spread(xs) > 20) return false;
  return true;
}

function isSwimlane(diagram: Diagram) {
  if (diagram.type !== "swimlane") return false;
  if (diagram.groups.length < 2) return false;
  const grouped = diagram.nodes.filter((n) => n.groupId).length;
  return grouped >= Math.ceil(diagram.nodes.length * 0.6);
}

function separateOverlaps(boxes: Box[], gap = 14) {
  for (let pass = 0; pass < 24; pass += 1) {
    let moved = false;
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (overlapX <= 1 || overlapY <= 1) continue;
        if (overlapX < overlapY) {
          const push = (overlapX + gap) / 2;
          const dir = a.x + a.w / 2 <= b.x + b.w / 2 ? -1 : 1;
          a.x += dir * push;
          b.x -= dir * push;
        } else {
          const push = (overlapY + gap) / 2;
          const dir = a.y + a.h / 2 <= b.y + b.h / 2 ? -1 : 1;
          a.y += dir * push;
          b.y -= dir * push;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
}

function snapValues(values: number[], threshold: number) {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const clusters: number[][] = [];
  for (const item of order) {
    const cluster = clusters[clusters.length - 1];
    if (
      cluster &&
      item.value - values[cluster[cluster.length - 1]] <= threshold
    ) {
      cluster.push(item.index);
    } else {
      clusters.push([item.index]);
    }
  }
  const next = [...values];
  for (const cluster of clusters) {
    if (cluster.length < 2) continue;
    const sorted = cluster.map((i) => values[i]).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    for (const i of cluster) next[i] = median;
  }
  return next;
}

function snapBoxes(boxes: Box[], xThreshold = 22, yThreshold = 18) {
  const cx = boxes.map((b) => b.x + b.w / 2);
  const cy = boxes.map((b) => b.y + b.h / 2);
  const sx = snapValues(cx, xThreshold);
  const sy = snapValues(cy, yThreshold);
  boxes.forEach((box, i) => {
    box.x = sx[i] - box.w / 2;
    box.y = sy[i] - box.h / 2;
  });
}

function normalize(boxes: Box[], groups: GroupBox[]) {
  const minX = Math.min(
    ...boxes.map((b) => b.x),
    ...groups.map((g) => g.x),
    0,
  );
  const minY = Math.min(
    ...boxes.map((b) => b.y),
    ...groups.map((g) => g.y),
    0,
  );
  const shiftX = minX < 36 ? 36 - minX : 0;
  const shiftY = minY < 40 ? 40 - minY : 0;
  for (const box of boxes) {
    box.x += shiftX;
    box.y += shiftY;
  }
  for (const group of groups) {
    group.x += shiftX;
    group.y += shiftY;
  }
}

function boundsOf(boxes: Box[], groups: GroupBox[]): LaidOut {
  const width =
    Math.max(
      960,
      ...boxes.map((b) => b.x + b.w),
      ...groups.map((g) => g.x + g.w),
    ) + 56;
  const height =
    Math.max(
      640,
      ...boxes.map((b) => b.y + b.h),
      ...groups.map((g) => g.y + g.h),
    ) + 56;
  return { width, height, nodes: boxes, groups };
}

function wrapGroups(diagram: Diagram, boxes: Box[]): GroupBox[] {
  const byId = new Map(diagram.nodes.map((node) => [node.id, node]));
  return diagram.groups.flatMap((group) => {
    const kids = boxes.filter((box) => byId.get(box.id)?.groupId === group.id);
    if (kids.length < 2 && !group.label) return [];
    if (!kids.length) return [];
    const padX = 18;
    const padY = 36;
    const x = Math.min(...kids.map((k) => k.x)) - padX;
    const y = Math.min(...kids.map((k) => k.y)) - padY;
    const right = Math.max(...kids.map((k) => k.x + k.w)) + padX;
    const bottom = Math.max(...kids.map((k) => k.y + k.h)) + 16;
    return [
      {
        id: group.id,
        label: group.label,
        x,
        y,
        w: right - x,
        h: bottom - y,
      },
    ];
  });
}

function finish(diagram: Diagram, boxes: Box[]) {
  snapBoxes(boxes);
  separateOverlaps(boxes);
  const groups = wrapGroups(diagram, boxes);
  normalize(boxes, groups);
  return boundsOf(boxes, groups);
}

function layoutFromGrid(diagram: Diagram): LaidOut {
  const nodes = diagram.nodes;
  const cols = uniqueSorted(
    nodes.map((n) => n.col).filter((v): v is number => v != null),
  );
  const rows = uniqueSorted(
    nodes.map((n) => n.row).filter((v): v is number => v != null),
  );
  const colGap = 36;
  const rowGap = 28;
  const emptyCol = 22;
  const emptyRow = 18;

  const minCol = cols[0];
  const maxCol = cols[cols.length - 1];
  const minRow = rows[0];
  const maxRow = rows[rows.length - 1];

  const colWidth = new Map<number, number>();
  const rowHeight = new Map<number, number>();
  for (let c = minCol; c <= maxCol; c += 1) {
    const members = nodes.filter((n) => n.col === c);
    colWidth.set(
      c,
      members.length
        ? Math.max(...members.map((n) => sizeOf(n).w))
        : emptyCol,
    );
  }
  for (let r = minRow; r <= maxRow; r += 1) {
    const members = nodes.filter((n) => n.row === r);
    rowHeight.set(
      r,
      members.length
        ? Math.max(...members.map((n) => sizeOf(n).h))
        : emptyRow,
    );
  }

  const colX = new Map<number, number>();
  let xCursor = 48;
  for (let c = minCol; c <= maxCol; c += 1) {
    colX.set(c, xCursor);
    xCursor += (colWidth.get(c) ?? emptyCol) + (nodes.some((n) => n.col === c) ? colGap : 12);
  }
  const rowY = new Map<number, number>();
  let yCursor = 48;
  for (let r = minRow; r <= maxRow; r += 1) {
    rowY.set(r, yCursor);
    yCursor += (rowHeight.get(r) ?? emptyRow) + (nodes.some((n) => n.row === r) ? rowGap : 10);
  }

  const fallbackCol = cols[Math.floor(cols.length / 2)] ?? 0;
  const fallbackRow = rows[Math.floor(rows.length / 2)] ?? 0;

  const boxes: Box[] = nodes.map((node) => {
    const { w, h } = sizeOf(node);
    const col = node.col ?? fallbackCol;
    const row = node.row ?? fallbackRow;
    const cellW = colWidth.get(col) ?? w;
    const cellH = rowHeight.get(row) ?? h;
    const cellX = colX.get(col) ?? 48;
    const cellY = rowY.get(row) ?? 48;
    return {
      id: node.id,
      x: cellX + (cellW - w) / 2,
      y: cellY + (cellH - h) / 2,
      w,
      h,
    };
  });

  return finish(diagram, boxes);
}

function asPercent(value: number | undefined, scale: number) {
  if (value == null || !Number.isFinite(value)) return undefined;
  return Math.min(100, Math.max(0, value * scale));
}

function percentScale(values: Array<number | undefined>) {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (!nums.length) return 1;
  return Math.max(...nums) <= 1.5 ? 100 : 1;
}

function layoutFromPositions(diagram: Diagram): LaidOut {
  const scale = percentScale(diagram.nodes.flatMap((n) => [n.x, n.y]));
  const xs = diagram.nodes
    .map((n) => asPercent(n.x, scale))
    .filter((v): v is number => v != null);
  const ys = diagram.nodes
    .map((n) => asPercent(n.y, scale))
    .filter((v): v is number => v != null);
  const xSpan = spread(xs) || 70;
  const ySpan = spread(ys) || 40;
  const canvasW = xSpan >= ySpan * 0.7 ? 2160 : 1120;
  const canvasH = Math.min(
    1480,
    Math.max(860, Math.round(canvasW * (ySpan / xSpan))),
  );

  const byId = new Map(diagram.nodes.map((n) => [n.id, n]));
  const boxes: Box[] = diagram.nodes.map((node) => {
    const { w, h } = sizeOf(node);
    let px = asPercent(node.x, scale);
    let py = asPercent(node.y, scale);
    if (px == null || py == null) {
      const neighbors = diagram.edges
        .flatMap((e) =>
          e.source === node.id ? [e.target] : e.target === node.id ? [e.source] : [],
        )
        .map((id) => byId.get(id))
        .filter((n): n is DiagramNode => Boolean(n && n.x != null && n.y != null));
      if (neighbors.length) {
        px =
          neighbors.reduce((sum, n) => sum + (asPercent(n.x, scale) ?? 50), 0) /
          neighbors.length;
        py =
          neighbors.reduce((sum, n) => sum + (asPercent(n.y, scale) ?? 50), 0) /
          neighbors.length;
      } else {
        px = 50;
        py = 50;
      }
    }
    return {
      id: node.id,
      x: (px / 100) * canvasW - w / 2,
      y: (py / 100) * canvasH - h / 2,
      w,
      h,
    };
  });

  const laid = finish(diagram, boxes);
  const ysPx = laid.nodes.map((n) => n.y);
  if (diagram.nodes.length >= 7 && spread(ysPx) < 90) {
    return layoutLayered(diagram);
  }
  return laid;
}

function graphRanks(diagram: Diagram) {
  const ids = diagram.nodes.map((n) => n.id);
  const incoming = new Map(ids.map((id) => [id, 0]));
  const outs = new Map(ids.map((id) => [id, [] as string[]]));
  for (const edge of diagram.edges) {
    if (!incoming.has(edge.source) || !incoming.has(edge.target)) continue;
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outs.get(edge.source)?.push(edge.target);
  }
  const rank = new Map(ids.map((id) => [id, 0]));
  const seen = new Set<string>();

  while (seen.size < ids.length) {
    let batch = ids.filter((id) => !seen.has(id) && (incoming.get(id) ?? 0) <= 0);
    if (!batch.length) {
      const rest = ids
        .filter((id) => !seen.has(id))
        .sort((a, b) => (incoming.get(a) ?? 0) - (incoming.get(b) ?? 0));
      batch = rest.slice(0, 1);
    }
    for (const id of batch) {
      if (seen.has(id)) continue;
      seen.add(id);
      for (const target of outs.get(id) ?? []) {
        if (seen.has(target)) continue;
        rank.set(target, Math.max(rank.get(target) ?? 0, (rank.get(id) ?? 0) + 1));
        incoming.set(target, Math.max(0, (incoming.get(target) ?? 1) - 1));
      }
    }
  }
  return rank;
}

function layoutLayered(diagram: Diagram): LaidOut {
  const g = new dagre.graphlib.Graph();
  const horizontal = diagram.direction === "LR" || diagram.direction === "RL";
  g.setGraph({
    rankdir: diagram.direction === "BT" || diagram.direction === "RL"
      ? diagram.direction
      : horizontal
        ? "LR"
        : "TB",
    nodesep: 40,
    ranksep: 78,
    edgesep: 18,
    marginx: 48,
    marginy: 48,
    acyclicer: "greedy",
    ranker: "network-simplex",
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of diagram.nodes) {
    const { w, h } = sizeOf(node);
    g.setNode(node.id, { width: w, height: h });
  }
  for (const edge of diagram.edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }
  dagre.layout(g);

  const boxes: Box[] = diagram.nodes.map((node) => {
    const laid = g.node(node.id);
    const { w, h } = sizeOf(node);
    return {
      id: node.id,
      x: (laid?.x ?? 0) - w / 2,
      y: (laid?.y ?? 0) - h / 2,
      w,
      h,
    };
  });

  return finish(diagram, boxes);
}

function layoutSwimlanes(diagram: Diagram): LaidOut {
  const ranks = graphRanks(diagram);
  const colW = 210;
  const colGap = 44;
  const lanePad = 28;
  const header = 40;
  const boxes: Box[] = [];
  let y = 32;

  for (const group of diagram.groups) {
    const members = diagram.nodes.filter((n) => n.groupId === group.id);
    if (!members.length) continue;
    const byRank = new Map<number, DiagramNode[]>();
    for (const node of members) {
      const rank = ranks.get(node.id) ?? 0;
      const list = byRank.get(rank) ?? [];
      list.push(node);
      byRank.set(rank, list);
    }
    let laneH = header + lanePad;
    for (const [, stack] of [...byRank.entries()].sort((a, b) => a[0] - b[0])) {
      let stackY = y + header;
      for (const node of stack) {
        const { w, h } = sizeOf(node);
        const rank = ranks.get(node.id) ?? 0;
        boxes.push({
          id: node.id,
          x: 40 + rank * (colW + colGap) + (colW - w) / 2,
          y: stackY,
          w,
          h,
        });
        stackY += h + 16;
      }
      laneH = Math.max(laneH, stackY - y + lanePad);
    }
    y += laneH + 24;
  }

  const orphans = diagram.nodes.filter(
    (n) => !n.groupId || !diagram.groups.some((g) => g.id === n.groupId),
  );
  if (orphans.length) {
    const extra = layoutLayered({ ...diagram, groups: [], nodes: orphans });
    for (const box of extra.nodes) {
      boxes.push({ ...box, y: box.y + y });
    }
  }

  return finish(diagram, boxes);
}

export function layoutDiagram(diagram: Diagram): LaidOut {
  if (canUseGrid(diagram)) return layoutFromGrid(diagram);
  if (canUseSpatial(diagram)) return layoutFromPositions(diagram);
  if (isSwimlane(diagram)) return layoutSwimlanes(diagram);
  return layoutLayered(diagram);
}

export function absNodeBoxes(layout: LaidOut) {
  const origin = new Map(layout.groups.map((g) => [g.id, g]));
  return layout.nodes.map((node) => {
    const parent = node.parentId ? origin.get(node.parentId) : undefined;
    return {
      ...node,
      x: node.x + (parent?.x ?? 0),
      y: node.y + (parent?.y ?? 0),
    };
  });
}

export function nodeMap(diagram: Diagram) {
  return new Map(diagram.nodes.map((n) => [n.id, n]));
}
