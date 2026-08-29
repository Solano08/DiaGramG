export type Rect = { x: number; y: number; w: number; h: number };
export type Side = "left" | "right" | "top" | "bottom";

const HANDLE: Record<Side, { source: string; target: string }> = {
  left: { source: "l-out", target: "l-in" },
  right: { source: "r-out", target: "r-in" },
  top: { source: "t-out", target: "t-in" },
  bottom: { source: "b-out", target: "b-in" },
};

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
  if (!fromSide || !toSide) return guessed;
  const explicitH = fromSide === "left" || fromSide === "right";
  const guessedH = guessed.source === "left" || guessed.source === "right";
  if (explicitH === guessedH) return { source: fromSide, target: toSide };
  return guessed;
}

export function pickHandles(
  from: Rect,
  to: Rect,
  fromSide?: Side,
  toSide?: Side,
) {
  const { source, target } = resolveSides(from, to, fromSide, toSide);
  return {
    sourceHandle: HANDLE[source].source,
    targetHandle: HANDLE[target].target,
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
    x: box.x - pad,
    y: box.y - pad,
    w: box.w + pad * 2,
    h: box.h + pad * 2,
  };
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

function elbowHits(
  start: { x: number; y: number },
  end: { x: number; y: number },
  source: Side,
  mid: number,
  boxes: Rect[],
) {
  if (source === "left" || source === "right") {
    return boxes.some(
      (box) =>
        hHits(start.y, start.x, mid, box) ||
        vHits(mid, start.y, end.y, box) ||
        hHits(end.y, mid, end.x, box),
    );
  }
  return boxes.some(
    (box) =>
      vHits(start.x, start.y, mid, box) ||
      hHits(mid, start.x, end.x, box) ||
      vHits(end.x, mid, end.y, box),
  );
}

function elbowPath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  source: Side,
  mid: number,
) {
  if (source === "left" || source === "right") {
    return {
      d: `M ${start.x} ${start.y} H ${mid} V ${end.y} H ${end.x}`,
      midPoint: { x: mid, y: (start.y + end.y) / 2 },
    };
  }
  return {
    d: `M ${start.x} ${start.y} V ${mid} H ${end.x} V ${end.y}`,
    midPoint: { x: (start.x + end.x) / 2, y: mid },
  };
}

export function orthogonalPath(
  from: Rect,
  to: Rect,
  obstacles: Rect[] = [],
  opts?: { source?: Side; target?: Side; startT?: number; endT?: number },
) {
  const { source, target } = resolveSides(from, to, opts?.source, opts?.target);
  const start = sideAnchor(from, source, opts?.startT ?? 0.5);
  const end = sideAnchor(to, target, opts?.endT ?? 0.5);
  const others = obstacles
    .filter((box) => box !== from && box !== to)
    .map((box) => inflate(box, 10));

  const baseMid =
    source === "left" || source === "right"
      ? (start.x + end.x) / 2
      : (start.y + end.y) / 2;

  const offsets = [0, 36, -36, 72, -72, 110, -110, 150, -150, 200, -200];
  let chosen = baseMid;
  for (const offset of offsets) {
    const mid = baseMid + offset;
    if (!elbowHits(start, end, source, mid, others)) {
      chosen = mid;
      break;
    }
  }

  const routed = elbowPath(start, end, source, chosen);
  return { d: routed.d, mid: routed.midPoint, source, target };
}

export function staggerT(index: number, total: number) {
  if (total <= 1) return 0.5;
  return 0.22 + (0.56 * index) / (total - 1);
}
