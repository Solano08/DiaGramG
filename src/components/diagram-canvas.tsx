"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import type { Diagram } from "@/lib/schema";
import {
  readLiveEdgePaths,
  sceneFromLive,
  type DiagramScene,
} from "@/lib/diagram-scene";
import {
  pathFromNode,
  presentationSteps,
  revealedAt,
  type PathHighlight,
} from "@/lib/graph-flow";
import { toFlow, type FlowNode, type NodeEmphasis } from "@/lib/to-flow";
import { nodeTypes } from "./diagram-nodes";
import { EdgeLabelEditContext, edgeTypes } from "./routed-edge";

const defaultEdgeOptions = { type: "routed" as const };

function CanvasInner({
  diagram,
  selectedId,
  presenting,
  presentStep,
  overview,
  cameraMode,
  onSelect,
  onPresentStep,
  onMove,
  onMoveLabel,
  onConnectNodes,
  onDeleteNodes,
  onDeleteEdges,
  onAddAt,
  onBindExport,
}: {
  diagram: Diagram;
  selectedId?: string | null;
  presenting: boolean;
  presentStep: number;
  overview: boolean;
  cameraMode: "overview" | "zoom" | "follow";
  onBindExport?: (getScene: (() => DiagramScene) | null) => void;
  onSelect: (id: string | null) => void;
  onPresentStep: (index: number) => void;
  onMove: (positions: Map<string, { x: number; y: number }>) => void;
  onMoveLabel: (edgeId: string, labelT: number) => void;
  onConnectNodes: (
    source: string,
    target: string,
    sourceHandle?: string | null,
    targetHandle?: string | null,
  ) => void;
  onDeleteNodes: (ids: string[]) => void;
  onDeleteEdges: (ids: string[]) => void;
  onAddAt: (position: { x: number; y: number }) => void;
}) {
  const flow = useMemo(() => toFlow(diagram), [diagram]);
  const [nodes, setNodes, onNodesChange] = useNodesState(flow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow.edges);
  const { screenToFlowPosition, fitView, getNode, getNodes, getInternalNode } = useReactFlow();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const leaveTimer = useRef<number>(0);
  const wasPresenting = useRef(false);
  const prevCameraRef = useRef<"overview" | "zoom" | "follow" | "off">("off");

  const steps = useMemo(() => presentationSteps(diagram), [diagram]);
  const path = useMemo(
    () => (presenting || !hoverId ? null : pathFromNode(diagram, hoverId)),
    [diagram, hoverId, presenting],
  );
  const reveal = useMemo(
    () => (presenting && !overview ? revealedAt(steps, presentStep) : null),
    [overview, presenting, presentStep, steps],
  );

  useEffect(() => {
    setNodes(flow.nodes);
    setEdges(flow.edges);
  }, [flow, setEdges, setNodes]);

  const captureScene = useCallback((): DiagramScene => {
    const liveNodes = getNodes().map((node) => {
      const internal = getInternalNode(node.id);
      return {
        id: node.id,
        type: node.type,
        position: internal?.internals.positionAbsolute ?? node.position,
        measured: internal?.measured ?? node.measured,
        width: node.width,
        height: node.height,
        style: node.style,
        data: node.data,
      };
    });
    return sceneFromLive(diagram, liveNodes, readLiveEdgePaths());
  }, [diagram, getInternalNode, getNodes]);

  useEffect(() => {
    onBindExport?.(captureScene);
    return () => onBindExport?.(null);
  }, [captureScene, onBindExport]);

  useEffect(() => {
    let timer = 0;
    const prevCamera = prevCameraRef.current;
    prevCameraRef.current = presenting ? cameraMode : "off";

    if (!presenting) {
      if (wasPresenting.current) {
        timer = window.setTimeout(() => {
          void fitView({
            padding: 0.16,
            duration: 0,
            minZoom: 0.08,
            maxZoom: 1.2,
          });
        }, 40);
      }
      wasPresenting.current = false;
      return () => window.clearTimeout(timer);
    }

    wasPresenting.current = true;

    if (cameraMode === "overview") {
      const run = () => {
        void fitView({ padding: 0.18, duration: 0, minZoom: 0.08, maxZoom: 1.15 });
      };
      timer = window.setTimeout(run, 40);
      const later = window.setTimeout(run, 280);
      return () => {
        window.clearTimeout(timer);
        window.clearTimeout(later);
      };
    }

    if (cameraMode === "follow" && prevCamera === "zoom") {
      return;
    }

    const focusId = cameraMode === "zoom" ? steps[0]?.nodeId : reveal?.current?.nodeId;
    const duration = cameraMode === "zoom" ? 900 : 520;
    if (!focusId) {
      void fitView({ padding: 0.18, duration, minZoom: 0.08, maxZoom: 1.15 });
      return;
    }
    const applyFocus = () => {
      const current = getNode(focusId);
      if (!current) {
        timer = window.setTimeout(applyFocus, 40);
        return;
      }
      const neighborIds = new Set<string>([focusId]);
      if (cameraMode === "follow") {
        for (const edge of diagram.edges) {
          if (edge.target === focusId) neighborIds.add(edge.source);
          if (edge.source === focusId) neighborIds.add(edge.target);
        }
      }
      void fitView({
        nodes: [...neighborIds].map((id) => ({ id })),
        padding: cameraMode === "zoom" ? 0.5 : 0.46,
        duration,
        minZoom: 0.28,
        maxZoom: 1.12,
      });
    };
    applyFocus();
    return () => window.clearTimeout(timer);
  }, [cameraMode, diagram.edges, fitView, getNode, presenting, presentStep, reveal?.current?.nodeId, steps]);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      if (node.type === "lane") return;
      if (presenting) {
        if (overview || cameraMode !== "follow") return;
        const index = steps.findIndex((step) => step.nodeId === node.id);
        if (index >= 0) onPresentStep(index);
        return;
      }
      onSelect(node.id);
    },
    [cameraMode, onPresentStep, onSelect, overview, presenting, steps],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (presenting) return;
      if (!connection.source || !connection.target) return;
      onConnectNodes(
        connection.source,
        connection.target,
        connection.sourceHandle,
        connection.targetHandle,
      );
    },
    [onConnectNodes, presenting],
  );

  const clearHoverSoon = useCallback(() => {
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setHoverId(null), 80);
  }, []);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  const painted = useMemo(() => {
    if (presenting && overview) {
      return nodes.map((node) => ({
        ...node,
        selected: false,
        data: { ...node.data, emphasis: "idle" as const },
        className: undefined,
      }));
    }
    if (!presenting && !path) {
      return nodes.map((node) => {
        const selected = node.type !== "lane" && node.id === selectedId;
        if (node.selected === selected) return node;
        return { ...node, selected };
      });
    }
    return nodes.map((node) => {
      if (node.type === "lane") return { ...node, selected: false };
      const emphasis = nodeEmphasis(node.id, { presenting, path, reveal });
      return {
        ...node,
        selected: !presenting && node.id === selectedId,
        data: { ...node.data, emphasis },
        className: emphasis && emphasis !== "idle" ? `rf-${emphasis}` : undefined,
      };
    });
  }, [nodes, overview, path, presenting, reveal, selectedId]);

  const paintedEdges = useMemo(() => {
    if (presenting && overview) return edges;
    if (!presenting && !path) return edges;
    return edges.map((edge) => styleEdge(edge, { presenting, path, reveal }));
  }, [edges, overview, path, presenting, reveal]);

  const labelEdit = useMemo(
    () => ({ editable: !presenting, onLabelT: onMoveLabel }),
    [onMoveLabel, presenting],
  );

  return (
    <EdgeLabelEditContext.Provider value={labelEdit}>
      <ReactFlow
      nodes={painted}
      edges={paintedEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={() => {
        if (presenting) return;
        onSelect(null);
        setHoverId(null);
      }}
      onNodeMouseEnter={(_, node) => {
        if (presenting || node.type === "lane") return;
        window.clearTimeout(leaveTimer.current);
        setHoverId(node.id);
      }}
      onNodeMouseLeave={() => {
        if (presenting) return;
        clearHoverSoon();
      }}
      onNodeDragStart={() => {
        window.clearTimeout(leaveTimer.current);
        setHoverId(null);
      }}
      onNodeDragStop={(_event, _node, next) => {
        const positions = new Map<string, { x: number; y: number }>();
        for (const node of next) {
          if (node.type === "lane") continue;
          positions.set(node.id, node.position);
        }
        onMove(positions);
      }}
      onConnect={onConnect}
      isValidConnection={(c) => Boolean(c.source && c.target && c.source !== c.target)}
      onNodesDelete={(deleted) => {
        const ids = deleted.filter((node) => node.type !== "lane").map((node) => node.id);
        if (ids.length) onDeleteNodes(ids);
      }}
      onEdgesDelete={(deleted) => onDeleteEdges(deleted.map((edge) => edge.id))}
      onDoubleClick={(event) => {
        if (presenting) return;
        const target = event.target as HTMLElement;
        if (!target.closest(".react-flow__pane")) return;
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        onAddAt(position);
      }}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      connectionLineType={ConnectionLineType.Step}
      connectionMode={ConnectionMode.Loose}
      fitView
      fitViewOptions={{ padding: 0.16, minZoom: 0.08, maxZoom: 1.4 }}
      minZoom={0.08}
      maxZoom={1.8}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={!presenting}
      nodesDraggable={!presenting}
      elementsSelectable={!presenting}
      deleteKeyCode={presenting ? null : ["Backspace", "Delete"]}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={22}
        size={1.4}
        color="#c4c4c4"
      />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        nodeColor={(node: FlowNode) => {
          if (node.type === "lane") return "#efe8db";
          if (node.type === "start") return "#cfe6dc";
          if (node.type === "end") return "#f0d4c6";
          if (node.type === "decision") return "#f3e3c0";
          return "#fffdf8";
        }}
        maskColor="rgba(244,239,230,0.7)"
      />
    </ReactFlow>
    </EdgeLabelEditContext.Provider>
  );
}

function nodeEmphasis(
  id: string,
  {
    presenting,
    path,
    reveal,
  }: {
    presenting: boolean;
    path: PathHighlight | null;
    reveal: ReturnType<typeof revealedAt> | null;
  },
): NodeEmphasis {
  if (presenting && reveal) {
    if (reveal.current?.nodeId === id) return "present-current";
    if (reveal.revealedNodes.has(id)) return "present-seen";
    return "present-hidden";
  }
  if (path) {
    if (path.focus === id) return "path-focus";
    if (path.upstream.has(id)) return "path-up";
    if (path.downstream.has(id)) return "path-down";
    return "dim";
  }
  return "idle";
}

function styleEdge(
  edge: Edge,
  {
    presenting,
    path,
    reveal,
  }: {
    presenting: boolean;
    path: PathHighlight | null;
    reveal: ReturnType<typeof revealedAt> | null;
  },
): Edge {
  const baseStyle = { ...(edge.style ?? {}) };
  const marker = edge.markerEnd && typeof edge.markerEnd === "object" ? { ...edge.markerEnd } : undefined;

  if (presenting && reveal) {
    const isCurrent = reveal.current?.incomingEdgeIds.includes(edge.id) ?? false;
    const isSeen = reveal.revealedEdges.has(edge.id);
    if (isCurrent) {
      return {
        ...edge,
        animated: true,
        className: `${edge.className ?? ""} is-present-current`.trim(),
        style: { ...baseStyle, stroke: "#0f6e5c", strokeWidth: 2.8, opacity: 1 },
        markerEnd: marker ? { ...marker, color: "#0f6e5c" } : edge.markerEnd,
      };
    }
    if (isSeen) {
      return {
        ...edge,
        animated: false,
        className: `${edge.className ?? ""} is-present-seen`.trim(),
        style: { ...baseStyle, opacity: 0.92 },
      };
    }
    return {
      ...edge,
      animated: false,
      className: `${edge.className ?? ""} is-present-hidden`.trim(),
      style: { ...baseStyle, opacity: 0.08 },
    };
  }

  if (path) {
    const onPath = path.edges.has(edge.id);
    const fromFocus = edge.source === path.focus;
    const toFocus = edge.target === path.focus;
    const up = path.upstream.has(edge.source) || toFocus;
    const color = fromFocus || !up ? "#c45c26" : "#0f6e5c";
    if (onPath) {
      return {
        ...edge,
        animated: true,
        className: `${edge.className ?? ""} is-on-path`.trim(),
        style: { ...baseStyle, stroke: color, strokeWidth: 2.7, opacity: 1 },
        markerEnd: marker ? { ...marker, color } : edge.markerEnd,
      };
    }
    return {
      ...edge,
      animated: false,
      className: `${edge.className ?? ""} is-path-dim`.trim(),
      style: { ...baseStyle, opacity: 0.12 },
    };
  }

  return edge;
}

export function DiagramCanvas(props: {
  diagram: Diagram;
  selectedId?: string | null;
  presenting?: boolean;
  presentStep?: number;
  overview?: boolean;
  cameraMode?: "overview" | "zoom" | "follow";
  onBindExport?: (getScene: (() => DiagramScene) | null) => void;
  onSelect: (id: string | null) => void;
  onPresentStep?: (index: number) => void;
  onMove: (positions: Map<string, { x: number; y: number }>) => void;
  onMoveLabel: (edgeId: string, labelT: number) => void;
  onConnectNodes: (
    source: string,
    target: string,
    sourceHandle?: string | null,
    targetHandle?: string | null,
  ) => void;
  onDeleteNodes: (ids: string[]) => void;
  onDeleteEdges: (ids: string[]) => void;
  onAddAt: (position: { x: number; y: number }) => void;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner
        diagram={props.diagram}
        selectedId={props.selectedId}
        presenting={props.presenting ?? false}
        presentStep={props.presentStep ?? 0}
        overview={props.overview ?? false}
        cameraMode={props.cameraMode ?? "follow"}
        onBindExport={props.onBindExport}
        onSelect={props.onSelect}
        onPresentStep={props.onPresentStep ?? (() => {})}
        onMove={props.onMove}
        onMoveLabel={props.onMoveLabel}
        onConnectNodes={props.onConnectNodes}
        onDeleteNodes={props.onDeleteNodes}
        onDeleteEdges={props.onDeleteEdges}
        onAddAt={props.onAddAt}
      />
    </ReactFlowProvider>
  );
}
