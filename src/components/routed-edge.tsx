"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  useStore,
  type EdgeProps,
  type ReactFlowState,
} from "@xyflow/react";
import {
  orthogonalPath,
  routeEdgeSet,
  sideFromHandle,
  staggerT,
  type EdgeRouteRequest,
  type Rect,
  type RoutedPath,
  type Side,
} from "@/lib/geometry";

type RouteData = {
  fromSide?: Side;
  toSide?: Side;
};

let cacheKey = "";
let cache = new Map<string, RoutedPath>();

function collectRects(state: ReactFlowState): Rect[] {
  const rects: Rect[] = [];
  for (const node of state.nodes) {
    if (node.type === "lane") continue;
    const internal = state.nodeLookup.get(node.id);
    let pos = internal?.internals.positionAbsolute ?? node.position;
    if (!internal?.internals.positionAbsolute && node.parentId) {
      const parent = state.nodeLookup.get(node.parentId);
      const origin = parent?.internals.positionAbsolute ?? parent?.position;
      if (origin) pos = { x: pos.x + origin.x, y: pos.y + origin.y };
    }
    const width = internal?.measured.width ?? node.measured?.width ?? node.width ?? 160;
    const height = internal?.measured.height ?? node.measured?.height ?? node.height ?? 72;
    if (!width || !height) continue;
    rects.push({ id: node.id, x: pos.x, y: pos.y, w: width, h: height });
  }
  return rects;
}

function collectRequests(state: ReactFlowState): EdgeRouteRequest[] {
  const pairCounts = new Map<string, number>();
  const pairIndex = new Map<string, number>();
  for (const edge of state.edges) {
    const key = `${edge.source}->${edge.target}`;
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }
  return state.edges.map((edge) => {
    const key = `${edge.source}->${edge.target}`;
    const total = pairCounts.get(key) ?? 1;
    const index = pairIndex.get(key) ?? 0;
    pairIndex.set(key, index + 1);
    const data = (edge.data ?? {}) as RouteData;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceSide: data.fromSide ?? sideFromHandle(edge.sourceHandle),
      targetSide: data.toSide ?? sideFromHandle(edge.targetHandle),
      startT: staggerT(index, total),
    };
  });
}

function geometryKey(rects: Rect[], requests: EdgeRouteRequest[], dragging: boolean) {
  const step = dragging ? 8 : 2;
  let key = dragging ? "d|" : "s|";
  for (const box of rects) {
    key += `${box.id}:${Math.round(box.x / step)}:${Math.round(box.y / step)}:${Math.round(box.w)}:${Math.round(box.h)};`;
  }
  key += "|";
  for (const edge of requests) {
    key += `${edge.id}:${edge.source}:${edge.target}:${edge.sourceSide ?? ""}:${edge.targetSide ?? ""}:${edge.startT ?? 0};`;
  }
  return key;
}

function draggingIds(state: ReactFlowState) {
  const ids: string[] = [];
  for (const node of state.nodes) {
    if (node.dragging) ids.push(node.id);
  }
  return ids;
}

function selectRoutes(state: ReactFlowState) {
  const moving = draggingIds(state);
  const dragging = moving.length > 0;
  const rects = collectRects(state);
  const requests = collectRequests(state);
  const key = geometryKey(rects, requests, dragging);
  if (key === cacheKey) return cache;
  cacheKey = key;

  if (dragging && cache.size) {
    const movingSet = new Set(moving);
    const byId = new Map(rects.filter((box) => box.id).map((box) => [box.id as string, box]));
    const next = new Map(cache);
    for (const edge of requests) {
      if (!movingSet.has(edge.source) && !movingSet.has(edge.target)) continue;
      const from = byId.get(edge.source);
      const to = byId.get(edge.target);
      if (!from || !to) continue;
      next.set(
        edge.id,
        orthogonalPath(from, to, rects, {
          source: edge.sourceSide,
          target: edge.targetSide,
          startT: edge.startT,
          fast: true,
        }),
      );
    }
    cache = next;
    return cache;
  }

  cache = routeEdgeSet(rects, requests);
  return cache;
}

function samePath(a?: RoutedPath, b?: RoutedPath) {
  return a === b || (a?.d === b?.d && a?.mid.x === b?.mid.x && a?.mid.y === b?.mid.y);
}

function RoutedEdgeInner({
  id,
  style,
  markerEnd,
  label,
  labelStyle,
}: EdgeProps) {
  const routed = useStore((state) => selectRoutes(state).get(id), samePath);
  if (!routed) return null;

  return (
    <>
      <BaseEdge id={id} path={routed.d} style={style} markerEnd={markerEnd} interactionWidth={24} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="routed-edge-label nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${routed.mid.x}px, ${routed.mid.y}px)`,
              ...labelStyle,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const RoutedEdge = memo(RoutedEdgeInner);

export const edgeTypes = {
  routed: RoutedEdge,
};
