export type Rect = { x: number; y: number; w: number; h: number; id?: string };
export type Side = "left" | "right" | "top" | "bottom";
export type Pt = { x: number; y: number };

const HANDLE: Record<Side, { source: string; target: string }> = {
  left: { source: "l-out", target: "l-in" },
  right: { source: "r-out", target: "r-in" },
  top: { source: "t-out", target: "t-in" },
  bottom: { source: "b-out", target: "b-in" },
};

export function handlesForSides(source: Side, target: Side) {
  return {
    sourceHandle: HANDLE[source].source,
    targetHandle: HANDLE[target].target,
  };
}

export function sideFromHandle(handle?: string | null): Side | undefined {
  if (!handle) return undefined;
  if (handle.startsWith("t")) return "top";
  if (handle.startsWith("b")) return "bottom";
  if (handle.startsWith("l")) return "left";
  if (handle.startsWith("r")) return "right";
  return undefined;
}

export function center(box: Rect) {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

export function pickSides(from: Rect, to: Rect): { source: Side; target: Side } {
  const a = center(from);
  const b = center(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { source: "right", target: "left" }
      : { source: "left", target: "right" };
  }
  return dy >= 0
    ? { source: "bottom", target: "top" }
    : { source: "top", target: "bottom" };
}

export function resolveSides(
  from: Rect,
  to: Rect,
  fromSide?: Side,
  toSide?: Side,
) {
  const guessed = pickSides(from, to);
  return {
    source: fromSide ?? guessed.source,
    target: toSide ?? guessed.target,
  };
}

export function pickHandles(
  from: Rect,
  to: Rect,
  fromSide?: Side,
  toSide?: Side,
) {
  const { source, target } = resolveSides(from, to, fromSide, toSide);
  return {
    ...handlesForSides(source, target),
    source,
    target,
  };
}

export function sideAnchor(box: Rect, side: Side, t = 0.5) {
  const along = Math.min(0.82, Math.max(0.18, t));
  switch (side) {
    case "left":
      return { x: box.x, y: box.y + box.h * along };
    case "right":
      return { x: box.x + box.w, y: box.y + box.h * along };
    case "top":
      return { x: box.x + box.w * along, y: box.y };
    case "bottom":
      return { x: box.x + box.w * along, y: box.y + box.h };
  }
}

function inflate(box: Rect, pad: number): Rect {
  return {
    id: box.id,
    x: box.x - pad,
    y: box.y - pad,
    w: box.w + pad * 2,
    h: box.h + pad * 2,
  };
}

function sameBox(a: Rect, b: Rect) {
  if (a === b) return true;
  if (a.id && b.id) return a.id === b.id;
  return false;
}

function hHits(y: number, x1: number, x2: number, box: Rect) {
  const lo = Math.min(x1, x2);
  const hi = Math.max(x1, x2);
  return y > box.y && y < box.y + box.h && hi > box.x && lo < box.x + box.w;
}

function vHits(x: number, y1: number, y2: number, box: Rect) {
  const lo = Math.min(y1, y2);
  const hi = Math.max(y1, y2);
  return x > box.x && x < box.x + box.w && hi > box.y && lo < box.y + box.h;
}

function unionBounds(boxes: Rect[]): Rect {
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.w));
  const bottom = Math.max(...boxes.map((box) => box.y + box.h));
  return { x, y, w: right - x, h: bottom - y };
}

function uniquePoints(points: Pt[]): Pt[] {
  const raw: Pt[] = [];
  for (const point of points) {
    const prev = raw[raw.length - 1];
    if (!prev || Math.abs(prev.x - point.x) > 0.6 || Math.abs(prev.y - point.y) > 0.6) {
      raw.push(point);
    }
  }
  const out: Pt[] = [];
  for (const point of raw) {
    while (out.length >= 2) {
      const a = out[out.length - 2];
      const b = out[out.length - 1];
      const col =
        (Math.abs(a.x - b.x) < 0.6 && Math.abs(b.x - point.x) < 0.6) ||
        (Math.abs(a.y - b.y) < 0.6 && Math.abs(b.y - point.y) < 0.6);
      if (!col) break;
      out.pop();
    }
    out.push(point);
  }
  return out;
}

function pathLength(points: Pt[]) {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length +=
      Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
  }
  return length;
}

export function clampLabelT(value: number) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(0.96, Math.max(0.04, value));
}

export function pointAlongPath(points: Pt[], t: number): Pt {
  const pts = uniquePoints(points);
  if (!pts.length) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0];
  const total = pathLength(pts);
  if (total <= 0) return pts[0];
  const target = Math.min(1, Math.max(0, t)) * total;
  let acc = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (acc + len >= target || i === pts.length - 1) {
      const u = len <= 0 ? 0 : Math.min(1, Math.max(0, (target - acc) / len));
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    }
    acc += len;
  }
  return pts[pts.length - 1];
}

export function closestTOnPath(points: Pt[], p: Pt): number {
  const pts = uniquePoints(points);
  if (pts.length < 2) return 0.5;
  const total = pathLength(pts);
  if (total <= 0) return 0.5;
  let bestDist = Number.POSITIVE_INFINITY;
  let bestAlong = 0;
  let along = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.abs(dx) + Math.abs(dy);
    const len2 = dx * dx + dy * dy;
    const u =
      len2 > 0
        ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
        : 0;
    const qx = a.x + dx * u;
    const qy = a.y + dy * u;
    const dist = (p.x - qx) * (p.x - qx) + (p.y - qy) * (p.y - qy);
    if (dist < bestDist) {
      bestDist = dist;
      bestAlong = along + u * len;
    }
    along += len;
  }
  return Math.min(1, Math.max(0, bestAlong / total));
}

export function edgeLabelPoint(path: { points: Pt[]; mid: Pt }, labelT?: number): Pt {
  if (labelT == null || !Number.isFinite(labelT)) return path.mid;
  return pointAlongPath(path.points, labelT);
}

function polylineHits(points: Pt[], boxes: Rect[]) {
  let hits = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (Math.abs(a.y - b.y) < 0.6) {
      hits += boxes.filter((box) => hHits(a.y, a.x, b.x, box)).length;
    } else if (Math.abs(a.x - b.x) < 0.6) {
      hits += boxes.filter((box) => vHits(a.x, a.y, b.y, box)).length;
    }
  }
  return hits;
}

function overlap1d(a1: number, a2: number, b1: number, b2: number) {
  const lo = Math.min(a1, a2);
  const hi = Math.max(a1, a2);
  return Math.max(0, Math.min(hi, b2) - Math.max(lo, b1));
}

function interiorLength(points: Pt[], region: Rect) {
  if (region.w < 24 || region.h < 24) return 0;
  let inside = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (Math.abs(a.y - b.y) < 0.6) {
      if (a.y > region.y && a.y < region.y + region.h) {
        inside += overlap1d(a.x, b.x, region.x, region.x + region.w);
      }
    } else if (Math.abs(a.x - b.x) < 0.6) {
      if (a.x > region.x && a.x < region.x + region.w) {
        inside += overlap1d(a.y, b.y, region.y, region.y + region.h);
      }
    }
  }
  return inside;
}

function spansBetween(from: Rect, to: Rect, box: Rect) {
  const a = center(from);
  const b = center(to);
  return (
    overlap1d(a.x, b.x, box.x, box.x + box.w) > 8 &&
    overlap1d(a.y, b.y, box.y, box.y + box.h) > 8
  );
}

function busyRegion(cluster: Rect): Rect {
  const insetX = Math.max(28, cluster.w * 0.1);
  const insetY = Math.max(28, cluster.h * 0.12);
  return {
    x: cluster.x + insetX,
    y: cluster.y + insetY,
    w: Math.max(8, cluster.w - insetX * 2),
    h: Math.max(8, cluster.h - insetY * 2),
  };
}

type Seg = { x1: number; y1: number; x2: number; y2: number; horiz: boolean };

function segments(points: Pt[]): Seg[] {
  const pts = uniquePoints(points);
  const out: Seg[] = [];
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    out.push({
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      horiz: Math.abs(a.y - b.y) < 0.6,
    });
  }
  return out;
}

function wireOverlap(points: Pt[], wires: Pt[][], sep = 18) {
  const mine = segments(points);
  let cost = 0;
  for (const wire of wires) {
    for (const s of mine) {
      for (const t of segments(wire)) {
        if (s.horiz && t.horiz && Math.abs(s.y1 - t.y1) < sep) {
          const overlap = overlap1d(
            Math.min(s.x1, s.x2),
            Math.max(s.x1, s.x2),
            Math.min(t.x1, t.x2),
            Math.max(t.x1, t.x2),
          );
          if (overlap > 10) {
            cost += overlap * (sep - Math.abs(s.y1 - t.y1) + 6);
          }
        } else if (!s.horiz && !t.horiz && Math.abs(s.x1 - t.x1) < sep) {
          const overlap = overlap1d(
            Math.min(s.y1, s.y2),
            Math.max(s.y1, s.y2),
            Math.min(t.y1, t.y2),
            Math.max(t.y1, t.y2),
          );
          if (overlap > 10) {
            cost += overlap * (sep - Math.abs(s.x1 - t.x1) + 6);
          }
        }
      }
    }
  }
  return cost;
}

function stub(point: Pt, side: Side, dist = 22): Pt {
  switch (side) {
    case "left":
      return { x: point.x - dist, y: point.y };
    case "right":
      return { x: point.x + dist, y: point.y };
    case "top":
      return { x: point.x, y: point.y - dist };
    case "bottom":
      return { x: point.x, y: point.y + dist };
  }
}

function hvh(start: Pt, end: Pt, midX: number): Pt[] {
  return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
}

function vhv(start: Pt, end: Pt, midY: number): Pt[] {
  return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
}

function aroundY(start: Pt, end: Pt, laneY: number, exitX: number, enterX: number): Pt[] {
  return [
    start,
    { x: exitX, y: start.y },
    { x: exitX, y: laneY },
    { x: enterX, y: laneY },
    { x: enterX, y: end.y },
    end,
  ];
}

function aroundX(start: Pt, end: Pt, laneX: number, exitY: number, enterY: number): Pt[] {
  return [
    start,
    { x: start.x, y: exitY },
    { x: laneX, y: exitY },
    { x: laneX, y: enterY },
    { x: end.x, y: enterY },
    end,
  ];
}

type Rim = "top" | "bottom" | "left" | "right";
type Rims = { top: number; bottom: number; left: number; right: number };

function wrapViaRim(
  start: Pt,
  end: Pt,
  startSide: Side,
  endSide: Side,
  rims: Rims,
  rim: Rim,
): Pt[] {
  const s0 = stub(start, startSide);
  const e0 = stub(end, endSide);
  const startJoin = joinToRim(s0, startSide, rims, rim);
  const endJoin = joinToRim(e0, endSide, rims, rim).reverse();
  const a = startJoin[startJoin.length - 1] ?? s0;
  const b = endJoin[0] ?? e0;
  return uniquePoints([start, s0, ...startJoin, ...rimWalk(a, b, rims), ...endJoin, e0, end]);
}

function joinToRim(point: Pt, side: Side, rims: Rims, rim: Rim): Pt[] {
  if (rim === "top" || rim === "bottom") {
    const y = rim === "top" ? rims.top : rims.bottom;
    if (side === "top" || side === "bottom") {
      return [{ x: point.x, y }];
    }
    const esc = point.x <= (rims.left + rims.right) / 2 ? rims.left : rims.right;
    return [
      { x: esc, y: point.y },
      { x: esc, y },
    ];
  }
  const x = rim === "left" ? rims.left : rims.right;
  if (side === "left" || side === "right") {
    return [{ x, y: point.y }];
  }
  const esc = point.y <= (rims.top + rims.bottom) / 2 ? rims.top : rims.bottom;
  return [
    { x: point.x, y: esc },
    { x, y: esc },
  ];
}

function projectToRim(point: Pt, rims: Rims): Pt {
  const clampedX = Math.min(rims.right, Math.max(rims.left, point.x));
  const clampedY = Math.min(rims.bottom, Math.max(rims.top, point.y));
  const candidates: Pt[] = [
    { x: clampedX, y: rims.top },
    { x: clampedX, y: rims.bottom },
    { x: rims.left, y: clampedY },
    { x: rims.right, y: clampedY },
  ];
  let best = candidates[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const dist = Math.abs(candidate.x - point.x) + Math.abs(candidate.y - point.y);
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

function perimeter(rims: Rims) {
  const w = rims.right - rims.left;
  const h = rims.bottom - rims.top;
  return 2 * (w + h);
}

function rimParam(point: Pt, rims: Rims) {
  const p = projectToRim(point, rims);
  const w = rims.right - rims.left;
  const h = rims.bottom - rims.top;
  if (Math.abs(p.y - rims.top) < 0.6) return p.x - rims.left;
  if (Math.abs(p.x - rims.right) < 0.6) return w + (p.y - rims.top);
  if (Math.abs(p.y - rims.bottom) < 0.6) return w + h + (rims.right - p.x);
  return w + h + w + (rims.bottom - p.y);
}

function pointAtParam(t: number, rims: Rims): Pt {
  const w = rims.right - rims.left;
  const h = rims.bottom - rims.top;
  const len = perimeter(rims);
  let p = ((t % len) + len) % len;
  if (p <= w) return { x: rims.left + p, y: rims.top };
  p -= w;
  if (p <= h) return { x: rims.right, y: rims.top + p };
  p -= h;
  if (p <= w) return { x: rims.right - p, y: rims.bottom };
  p -= w;
  return { x: rims.left, y: rims.bottom - p };
}

function rimWalk(from: Pt, to: Pt, rims: Rims): Pt[] {
  const len = perimeter(rims);
  const a = rimParam(from, rims);
  const b = rimParam(to, rims);
  const cw = (b - a + len) % len;
  const ccw = (a - b + len) % len;
  const dir = cw <= ccw ? 1 : -1;
  const dist = Math.min(cw, ccw);
  const corners = [0, rims.right - rims.left, rims.right - rims.left + (rims.bottom - rims.top), len - (rims.bottom - rims.top), len];
  const points: Pt[] = [projectToRim(from, rims)];
  for (const corner of corners) {
    const d = dir === 1 ? (corner - a + len) % len : (a - corner + len) % len;
    if (d > 1 && d < dist - 1) points.push(pointAtParam(corner, rims));
  }
  points.push(projectToRim(to, rims));
  return uniquePoints(points);
}

function midPoint(points: Pt[]) {
  const pts = uniquePoints(points);
  if (pts.length < 2) return pts[0] ?? { x: 0, y: 0 };
  let best = 0;
  let bestLen = -1;
  const last = pts.length - 1;
  for (let i = 1; i < pts.length; i += 1) {
    const len =
      Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
    const endish = i === 1 || i === last ? 0.72 : 1;
    const score = len * endish;
    if (score > bestLen) {
      bestLen = score;
      best = i;
    }
  }
  const a = pts[best - 1];
  const b = pts[best];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function toD(points: Pt[]) {
  return uniquePoints(points)
    .map((point, index) => `${index ? "L" : "M"} ${Math.round(point.x)} ${Math.round(point.y)}`)
    .join(" ");
}

export type RoutedPath = {
  d: string;
  mid: Pt;
  points: Pt[];
  source: Side;
  target: Side;
  sourceHandle: string;
  targetHandle: string;
};

function scorePath(
  points: Pt[],
  boxes: Rect[],
  cluster: Rect,
  wires: Pt[][],
  sidePenalty: number,
  longHop: boolean,
) {
  const pts = uniquePoints(points);
  if (pts.length < 2) return Number.POSITIVE_INFINITY;
  const hits = polylineHits(pts, boxes);
  const interior = longHop ? interiorLength(pts, cluster) : 0;
  const busy = longHop ? interiorLength(pts, busyRegion(cluster)) : 0;
  const length = pathLength(pts);
  const bends = Math.max(0, pts.length - 2);
  const overlap = wireOverlap(pts, wires);
  return (
    hits * 120000 +
    busy * 85 +
    interior * 8 +
    overlap * 4.5 +
    length +
    bends * 14 +
    sidePenalty
  );
}

function sidesForRim(rim: Rim): [Side, Side] {
  switch (rim) {
    case "top":
      return ["top", "top"];
    case "bottom":
      return ["bottom", "bottom"];
    case "left":
      return ["left", "left"];
    case "right":
      return ["right", "right"];
  }
}

export function orthogonalPath(
  from: Rect,
  to: Rect,
  obstacles: Rect[] = [],
  opts?: {
    source?: Side;
    target?: Side;
    startT?: number;
    endT?: number;
    wires?: Pt[][];
    fast?: boolean;
  },
): RoutedPath {
  const preferred = resolveSides(from, to, opts?.source, opts?.target);
  const startT = opts?.startT ?? 0.5;
  const endT = opts?.endT ?? 0.5;

  if (opts?.fast) {
    const start = sideAnchor(from, preferred.source, startT);
    const end = sideAnchor(to, preferred.target, endT);
    const s0 = stub(start, preferred.source);
    const e0 = stub(end, preferred.target);
    const hv = uniquePoints([start, ...hvh(s0, e0, (s0.x + e0.x) / 2), end]);
    const vh = uniquePoints([start, ...vhv(s0, e0, (s0.y + e0.y) / 2), end]);
    const pts = pathLength(hv) <= pathLength(vh) ? hv : vh;
    return {
      d: toD(pts),
      mid: midPoint(pts),
      points: pts,
      source: preferred.source,
      target: preferred.target,
      ...handlesForSides(preferred.source, preferred.target),
    };
  }

  const others = obstacles
    .filter((box) => !sameBox(box, from) && !sameBox(box, to))
    .map((box) => inflate(box, 14));
  const between = others.filter((box) => spansBetween(from, to, box));
  const cluster = unionBounds([from, to, ...between]);
  const wires = opts?.wires ?? [];
  const longHop = between.length >= 2;
  const pads = longHop ? [48, 84, 128] : [];

  let bestPoints: Pt[] = [
    sideAnchor(from, preferred.source, startT),
    sideAnchor(to, preferred.target, endT),
  ];
  let bestScore = Number.POSITIVE_INFINITY;
  let bestSides = preferred;

  const consider = (points: Pt[], source: Side, target: Side, extra = 0) => {
    const score = scorePath(points, others, cluster, wires, extra, longHop);
    if (score < bestScore) {
      bestScore = score;
      bestPoints = points;
      bestSides = { source, target };
    }
  };

  const localPairs: Array<[Side, Side]> = [
    [preferred.source, preferred.target],
    ["right", "left"],
    ["left", "right"],
    ["bottom", "top"],
    ["top", "bottom"],
    ["bottom", "bottom"],
    ["top", "top"],
    ["left", "left"],
    ["right", "right"],
  ];
  if (opts?.source && opts?.target) localPairs.unshift([opts.source, opts.target]);

  const seenPairs = new Set<string>();
  for (const [source, target] of localPairs) {
    const key = `${source}:${target}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    const start = sideAnchor(from, source, startT);
    const end = sideAnchor(to, target, endT);
    const s0 = stub(start, source);
    const e0 = stub(end, target);
    let extra = 0;
    if (source !== preferred.source || target !== preferred.target) extra += 55;
    if (opts?.source && source !== opts.source) extra += 90;
    if (opts?.target && target !== opts.target) extra += 90;

    const midX = (s0.x + e0.x) / 2;
    const midY = (s0.y + e0.y) / 2;
    for (const offset of [0, 36, -36, 80, -80]) {
      consider([start, ...hvh(s0, e0, midX + offset), end], source, target, extra);
      consider([start, ...vhv(s0, e0, midY + offset), end], source, target, extra);
    }
  }

  for (const pad of pads) {
    const rims: Rims = {
      top: cluster.y - pad,
      bottom: cluster.y + cluster.h + pad,
      left: cluster.x - pad,
      right: cluster.x + cluster.w + pad,
    };
    const wrapBonus = -40;
    for (const rim of ["top", "bottom", "left", "right"] as Rim[]) {
      const [rimSource, rimTarget] = sidesForRim(rim);
      const wrapPairs: Array<[Side, Side]> = [
        [rimSource, rimTarget],
        [preferred.source, preferred.target],
      ];
      const seenWrap = new Set<string>();
      for (const [source, target] of wrapPairs) {
        const key = `${rim}:${source}:${target}`;
        if (seenWrap.has(key)) continue;
        seenWrap.add(key);
        const start = sideAnchor(from, source, startT);
        const end = sideAnchor(to, target, endT);
        let extra = wrapBonus;
        if (source !== preferred.source || target !== preferred.target) extra += 40;
        if (opts?.source && source !== opts.source) extra += 70;
        if (opts?.target && target !== opts.target) extra += 70;
        consider(wrapViaRim(start, end, source, target, rims, rim), source, target, extra);

        const s0 = stub(start, source);
        const e0 = stub(end, target);
        if (rim === "top" || rim === "bottom") {
          const laneY = rim === "top" ? rims.top : rims.bottom;
          consider(
            [start, ...aroundY(s0, e0, laneY, rims.left, rims.right), end],
            source,
            target,
            extra - 16,
          );
          consider(
            [start, ...aroundY(s0, e0, laneY, rims.right, rims.left), end],
            source,
            target,
            extra - 16,
          );
          consider(
            [start, ...aroundY(s0, e0, laneY, s0.x, e0.x), end],
            source,
            target,
            extra - 32,
          );
          consider(
            [start, ...aroundY(s0, e0, laneY, s0.x, rims.left), end],
            source,
            target,
            extra - 26,
          );
          consider(
            [start, ...aroundY(s0, e0, laneY, s0.x, rims.right), end],
            source,
            target,
            extra - 26,
          );
        } else {
          const laneX = rim === "left" ? rims.left : rims.right;
          consider(
            [start, ...aroundX(s0, e0, laneX, rims.top, rims.bottom), end],
            source,
            target,
            extra - 16,
          );
          consider(
            [start, ...aroundX(s0, e0, laneX, rims.bottom, rims.top), end],
            source,
            target,
            extra - 16,
          );
          consider(
            [start, ...aroundX(s0, e0, laneX, s0.y, e0.y), end],
            source,
            target,
            extra - 32,
          );
          consider(
            [start, ...aroundX(s0, e0, laneX, s0.y, rims.top), end],
            source,
            target,
            extra - 26,
          );
          consider(
            [start, ...aroundX(s0, e0, laneX, s0.y, rims.bottom), end],
            source,
            target,
            extra - 26,
          );
        }
      }
    }
  }

  const pts = uniquePoints(bestPoints);
  return {
    d: toD(pts),
    mid: midPoint(pts),
    points: pts,
    source: bestSides.source,
    target: bestSides.target,
    ...handlesForSides(bestSides.source, bestSides.target),
  };
}

export function staggerT(index: number, total: number) {
  if (total <= 1) return 0.5;
  return 0.22 + (0.56 * index) / (total - 1);
}

export type EdgeRouteRequest = {
  id: string;
  source: string;
  target: string;
  sourceSide?: Side;
  targetSide?: Side;
  startT?: number;
  endT?: number;
};

export function routeEdgeSet(rects: Rect[], edges: EdgeRouteRequest[]) {
  const byId = new Map(
    rects.filter((box) => box.id).map((box) => [box.id as string, box]),
  );
  const wires: Pt[][] = [];
  const out = new Map<string, RoutedPath>();
  const ranked = [...edges].sort((a, b) => {
    const fa = byId.get(a.source);
    const ta = byId.get(a.target);
    const fb = byId.get(b.source);
    const tb = byId.get(b.target);
    const da =
      fa && ta
        ? Math.abs(center(ta).x - center(fa).x) + Math.abs(center(ta).y - center(fa).y)
        : 0;
    const db =
      fb && tb
        ? Math.abs(center(tb).x - center(fb).x) + Math.abs(center(tb).y - center(fb).y)
        : 0;
    return da - db;
  });

  for (const edge of ranked) {
    const from = byId.get(edge.source);
    const to = byId.get(edge.target);
    if (!from || !to) continue;
    const routed = orthogonalPath(from, to, rects, {
      source: edge.sourceSide,
      target: edge.targetSide,
      startT: edge.startT,
      endT: edge.endT,
      wires,
    });
    wires.push(routed.points);
    out.set(edge.id, routed);
  }
  return out;
}
