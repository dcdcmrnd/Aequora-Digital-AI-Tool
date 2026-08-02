"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node as RFNode,
  type Edge as RFEdge,
} from "@xyflow/react";

import { CanvasNode } from "@/components/automation/CanvasNode";
import { NodeConfigPanel } from "@/components/automation/NodeConfigPanel";
import { PlaceholderNode } from "@/components/automation/PlaceholderNode";
import type { AutomationFlow, AutomationNode, AutomationNodeType, PipelineStage } from "@/types";

const nodeTypes = {
  trigger: CanvasNode,
  send_email: CanvasNode,
  add_tag: CanvasNode,
  move_pipeline_stage: CanvasNode,
  condition: CanvasNode,
  wait: CanvasNode,
  placeholder: PlaceholderNode,
};

const COL_WIDTH = 260;
const ROW_HEIGHT = 150;

function layout(nodes: AutomationNode[], edges: AutomationFlow["edges"]): AutomationNode[] {
  const trigger = nodes.find((n) => n.type === "trigger");
  if (!trigger) return nodes;

  const childrenOf = (id: string) => edges.filter((e) => e.source === id).map((e) => e.target);
  const positions = new Map<string, number>();
  let nextCol = 0;

  function place(nodeId: string, depth: number): number {
    if (positions.has(nodeId)) return positions.get(nodeId)!;
    const kids = childrenOf(nodeId).filter((id) => nodes.some((n) => n.id === id));
    let x: number;
    if (kids.length === 0) {
      x = nextCol * COL_WIDTH;
      nextCol += 1;
    } else {
      const xs = kids.map((k) => place(k, depth + 1));
      x = (Math.min(...xs) + Math.max(...xs)) / 2;
    }
    positions.set(nodeId, x);
    return x;
  }

  const depthOf = new Map<string, number>();
  function assignDepth(id: string, depth: number) {
    depthOf.set(id, depth);
    for (const kid of childrenOf(id)) assignDepth(kid, depth + 1);
  }
  assignDepth(trigger.id, 0);
  place(trigger.id, 0);

  return nodes.map((n) => ({
    ...n,
    position: { x: positions.get(n.id) ?? n.position.x, y: (depthOf.get(n.id) ?? 0) * ROW_HEIGHT },
  }));
}

function defaultDataFor(type: AutomationNodeType): Record<string, unknown> {
  if (type === "wait") return { mode: "duration", amount: 1, unit: "hours" };
  return {};
}

function withPlaceholders(
  nodes: AutomationNode[],
  edges: AutomationFlow["edges"],
  onPick: (sourceId: string, branch: string | undefined, type: AutomationNodeType) => void,
): { nodes: RFNode[]; edges: RFEdge[] } {
  const phNodes: RFNode[] = [];
  const phEdges: RFEdge[] = [];

  for (const node of nodes) {
    const outgoing = edges.filter((e) => e.source === node.id);
    const branches: (string | undefined)[] = node.type === "condition" ? ["yes", "no"] : [undefined];

    for (const branch of branches) {
      const has = outgoing.some((e) => (branch === undefined ? true : e.sourceHandle === branch));
      if (has) continue;
      const phId = `placeholder-${node.id}-${branch ?? "default"}`;
      const xOffset = branch === "yes" ? -90 : branch === "no" ? 90 : 0;
      phNodes.push({
        id: phId,
        type: "placeholder",
        position: { x: node.position.x + xOffset, y: node.position.y + ROW_HEIGHT },
        data: { onPick: (type: AutomationNodeType) => onPick(node.id, branch, type) },
        draggable: false,
      });
      phEdges.push({ id: `edge-${phId}`, source: node.id, target: phId, sourceHandle: branch ?? null, type: "smoothstep" });
    }
  }

  return {
    nodes: [
      ...nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
      ...phNodes,
    ],
    edges: [...edges.map((e) => ({ ...e, type: "smoothstep" })), ...phEdges],
  };
}

interface AutomationCanvasProps {
  flow: AutomationFlow;
  onChange: (flow: AutomationFlow) => void;
  stages: PipelineStage[];
}

function CanvasInner({ flow, onChange, stages }: AutomationCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Real (persisted) nodes/edges live here, separate from React Flow's
  // render state below -- this is the source of truth we report upward via
  // onChange, and never carries React Flow's internal `measured`/`selected`
  // bookkeeping fields.
  const [realNodes, setRealNodes] = useState<AutomationNode[]>(flow.nodes);
  const [realEdges, setRealEdges] = useState<AutomationFlow["edges"]>(flow.edges);

  const handlePick = useCallback((sourceId: string, branch: string | undefined, type: AutomationNodeType) => {
    const newId = crypto.randomUUID();
    setRealNodes((prev) => {
      const newNode: AutomationNode = { id: newId, type, position: { x: 0, y: 0 }, data: defaultDataFor(type) };
      return layout([...prev, newNode], [...realEdges, { id: "", source: sourceId, target: newId, sourceHandle: branch ?? null }]);
    });
    setRealEdges((prev) => [...prev, { id: crypto.randomUUID(), source: sourceId, target: newId, sourceHandle: branch ?? null }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realEdges]);

  // React Flow owns rendering + measurement state. We rebuild the desired
  // node/edge list (real + freshly computed placeholders) whenever the real
  // structure changes and hand it to React Flow's own setters, which merge
  // it against already-measured nodes by id rather than discarding their
  // measured dimensions -- unlike a hand-rolled onNodesChange filter, this
  // never silently drops the "finished measuring, now show it" event.
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<RFNode>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<RFEdge>([]);

  useEffect(() => {
    const { nodes, edges } = withPlaceholders(realNodes, realEdges, handlePick);
    setRfNodes(nodes.map((n) => ({ ...n, selected: n.id === selectedId })));
    setRfEdges(edges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realNodes, realEdges, handlePick, selectedId]);

  // Report the real (non-placeholder) structure upward for saving.
  useEffect(() => {
    onChange({ nodes: realNodes, edges: realEdges });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realNodes, realEdges]);

  function handleNodeClick(_: unknown, node: RFNode) {
    if (node.type === "placeholder") return;
    setSelectedId(node.id);
  }

  const selectedNode = realNodes.find((n) => n.id === selectedId) ?? null;

  function handleSaveNode(data: Record<string, unknown>) {
    if (!selectedId) return;
    setRealNodes((prev) => prev.map((n) => (n.id === selectedId ? { ...n, data } : n)));
    setSelectedId(null);
  }

  function handleDeleteNode() {
    if (!selectedId) return;
    const toRemove = new Set<string>();
    function collect(id: string) {
      toRemove.add(id);
      realEdges.filter((e) => e.source === id).forEach((e) => collect(e.target));
    }
    collect(selectedId);
    setRealNodes((prev) => prev.filter((n) => !toRemove.has(n.id)));
    setRealEdges((prev) => prev.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target)));
    setSelectedId(null);
  }

  const memoNodeTypes = useMemo(() => nodeTypes, []);

  return (
    <div className="relative h-[70vh] w-full rounded-card border border-border bg-surface-secondary">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={memoNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        defaultViewport={{ x: 120, y: 60, zoom: 1 }}
        minZoom={0.3}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>

      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          stages={stages}
          onClose={() => setSelectedId(null)}
          onSave={handleSaveNode}
          onDelete={handleDeleteNode}
          canDelete={selectedNode.type !== "trigger"}
        />
      )}
    </div>
  );
}

export function AutomationCanvas(props: AutomationCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
