"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/cn";
import type { FlowData } from "@/lib/to-flow";
import type { NodeKind } from "@/lib/schema";

function Handles() {
  return (
    <>
      <Handle id="t-in" type="target" position={Position.Top} />
      <Handle id="t-out" type="source" position={Position.Top} />
      <Handle id="l-in" type="target" position={Position.Left} />
      <Handle id="l-out" type="source" position={Position.Left} />
      <Handle id="r-in" type="target" position={Position.Right} />
      <Handle id="r-out" type="source" position={Position.Right} />
      <Handle id="b-in" type="target" position={Position.Bottom} />
      <Handle id="b-out" type="source" position={Position.Bottom} />
    </>
  );
}

function Card({
  data,
  selected,
}: {
  data: FlowData;
  selected?: boolean;
}) {
  const kind = (data.kind === "lane" ? "note" : data.kind) as NodeKind;
  return (
    <div
      className={cn(
        "diagram-node",
        `kind-${kind}`,
        selected && "is-selected",
        data.emphasis && data.emphasis !== "idle" && `is-${data.emphasis}`,
      )}
    >
      <Handles />
      {data.badge ? <span className="node-badge">{data.badge}</span> : null}
      <strong>{data.label}</strong>
    </div>
  );
}

function makeNode() {
  return memo(function DiagramCard(props: NodeProps) {
    return (
      <Card
        data={props.data as FlowData}
        selected={props.selected}
      />
    );
  });
}

export const StartNode = makeNode();
export const EndNode = makeNode();
export const ProcessNode = makeNode();
export const DecisionNode = makeNode();
export const DataNode = makeNode();
export const ActorNode = makeNode();
export const SystemNode = makeNode();
export const IoNode = makeNode();
export const NoteNode = makeNode();
export const DocumentNode = makeNode();

export const LaneNode = memo(function LaneNode(props: NodeProps) {
  const data = props.data as FlowData;
  return (
    <div className="lane-node">
      <div className="lane-title">{data.label}</div>
    </div>
  );
});

export const nodeTypes = {
  start: StartNode,
  end: EndNode,
  process: ProcessNode,
  decision: DecisionNode,
  data: DataNode,
  actor: ActorNode,
  system: SystemNode,
  io: IoNode,
  note: NoteNode,
  document: DocumentNode,
  lane: LaneNode,
};
