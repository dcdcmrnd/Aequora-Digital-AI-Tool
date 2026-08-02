"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  applyNodeChanges,
  type NodeChange,
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

interface AutomationCanvasProps {
  flow: AutomationFlow;
  onChange: (flow: AutomationFlow) => void;
  stages: PipelineStage[];
}

function CanvasInner({ flow, onChange, stages }: AutomationCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const realNodes = flow.nodes;
  const realEdges = flow.edges;

  function commit(nodes: AutomationNode[], edges: AutomationFlow["edges"]) {
    onChange({ nodes: layout(nodes, edges), edges });
  }

  const handlePick = useCallback(
    (sourceId: string, branch: string | undefined, type: AutomationNodeType) => {
      const newId = crypto.randomUUID();
      const newNode: AutomationNode = { id: newId, type, position: { x: 0, y: 0 }, data: defaultDataFor(type) };
      const newEdge = { id: crypto.randomUUID(), source: sourceId, target: newId, sourceHandle: branch ?? null };
      commit([...realNodes, newNode], [...realEdges, newEdge]);
    },
    [realNodes, realEdges],
  );

  // Every leaf (no outgoing edge for its available branch(es)) gets a placeholder "+" node.
  const { placeholderNodes, placeholderEdges } = useMemo(() => {
    const pNodes: RFNode[] = [];
    const pEdges: RFEdge[] = [];

    for (const node of realNodes) {
      const outgoing = realEdges.filter((e) => e.source === node.id);
      const branches: (string | undefined)[] = node.type === "condition" ? ["yes", "no"] : [undefined];

      for (const branch of branches) {
        const has = outgoing.some((e) => (branch === undefined ? true : e.sourceHandle === branch));
        if (has) continue;
        const phId = `placeholder-${node.id}-${branch ?? "default"}`;
        const xOffset = branch === "yes" ? -90 : branch === "no" ? 90 : 0;
        pNodes.push({
          id: phId,
          type: "placeholder",
          position: { x: node.position.x + xOffset, y: node.position.y + ROW_HEIGHT },
          data: { onPick: (type: AutomationNodeType) => handlePick(node.id, branch, type) },
          draggable: false,
        });
        pEdges.push({ id: `edge-${phId}`, source: node.id, target: phId, sourceHandle: branch ?? null, type: "smoothstep" });
      }
    }

    return { placeholderNodes: pNodes, placeholderEdges: pEdges };
  }, [realNodes, realEdges, handlePick]);

  const displayNodes: RFNode[] = useMemo(
    () => [
      ...realNodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
        selected: n.id === selectedId,
      })),
      ...placeholderNodes,
    ],
    [realNodes, placeholderNodes, selectedId],
  );

  const displayEdges: RFEdge[] = useMemo(
    () => [
      ...realEdges.map((e) => ({ ...e, type: "smoothstep" })),
      ...placeholderEdges,
    ],
    [realEdges, placeholderEdges],
  );

  function handleNodesChange(changes: NodeChange[]) {
    const realOnly = changes.filter((c) => "id" in c && realNodes.some((n) => n.id === c.id));
    if (realOnly.length === 0) return;
    const updated = applyNodeChanges(realOnly, realNodes as unknown as RFNode[]) as unknown as AutomationNode[];
    onChange({ nodes: updated, edges: realEdges });
  }

  function handleNodeClick(_: unknown, node: RFNode) {
    if (node.type === "placeholder") return;
    setSelectedId(node.id);
  }

  const selectedNode = realNodes.find((n) => n.id === selectedId) ?? null;

  function handleSaveNode(data: Record<string, unknown>) {
    if (!selectedId) return;
    commit(
      realNodes.map((n) => (n.id === selectedId ? { ...n, data } : n)),
      realEdges,
    );
    setSelectedId(null);
  }

  function handleDeleteNode() {
    if (!selectedId) return;
    // Remove the node and everything downstream of it (a whole subtree).
    const toRemove = new Set<string>();
    function collect(id: string) {
      toRemove.add(id);
      realEdges.filter((e) => e.source === id).forEach((e) => collect(e.target));
    }
    collect(selectedId);
    commit(
      realNodes.filter((n) => !toRemove.has(n.id)),
      realEdges.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target)),
    );
    setSelectedId(null);
  }

  return (
    <div className="relative h-[70vh] w-full rounded-card border border-border bg-surface-secondary">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onNodeClick={handleNodeClick}
        fitView
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
