"use client";

import { useCallback } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  ReactFlowProvider,
  type Node,
} from "@xyflow/react";
import type { Diagram } from "@/lib/schema";
import { toFlow, type FlowNode } from "@/lib/to-flow";
import { nodeTypes } from "./diagram-nodes";

function CanvasInner({
  diagram,
  selectedId,
  onSelect,
}: {
  diagram: Diagram;
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
}) {
  const flow = toFlow(diagram);
  const [nodes, , onNodesChange] = useNodesState(flow.nodes);
  const [edges, , onEdgesChange] = useEdgesState(flow.edges);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      if (node.type === "lane") return;
      onSelect(node.id);
    },
    [onSelect],
  );

  const painted = nodes.map((node) =>
    node.id === selectedId
      ? { ...node, selected: true }
      : { ...node, selected: false },
  );

  return (
    <ReactFlow
      nodes={painted}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={() => onSelect(null)}
      nodeTypes={nodeTypes}
      defaultEdgeOptions={{ type: "step" }}
      fitView
      fitViewOptions={{ padding: 0.16, minZoom: 0.08, maxZoom: 1.4 }}
      minZoom={0.08}
      maxZoom={1.8}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
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
  );
}

export function DiagramCanvas(props: {
  diagram: Diagram;
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
}) {
  const key = [
    props.diagram.title,
    props.diagram.direction,
    props.diagram.nodes.map((n) => `${n.id}:${n.col ?? ""}:${n.row ?? ""}:${n.x ?? ""}:${n.y ?? ""}:${n.groupId ?? ""}`).join("|"),
    props.diagram.edges.map((e) => `${e.id}:${e.source}:${e.target}`).join("|"),
    props.diagram.groups.map((g) => `${g.id}:${g.x ?? ""}:${g.y ?? ""}`).join("|"),
  ].join("::");
  return (
    <ReactFlowProvider key={key}>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
