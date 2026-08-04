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
import { Redo2, Undo2 } from "lucide-react";

import { CanvasNode } from "@/components/automation/CanvasNode";
import { InsertableEdge } from "@/components/automation/InsertableEdge";
import { NodeConfigPanel } from "@/components/automation/NodeConfigPanel";
import { NodeContactsPanel } from "@/components/automation/NodeContactsPanel";
import { NodePickerPanel } from "@/components/automation/NodePickerPanel";
import { PlaceholderNode } from "@/components/automation/PlaceholderNode";
import { useAutomationNodeCounts } from "@/hooks/useAutomations";
import { NODE_DEFINITIONS } from "@/lib/automation/nodeRegistry";
import type { AutomationFlow, AutomationNode, AutomationNodeType, PipelineStage } from "@/types";

const nodeTypes: Record<AutomationNodeType | "placeholder", typeof CanvasNode | typeof PlaceholderNode> = {
  trigger: CanvasNode,
  send_email: CanvasNode,
  add_tag: CanvasNode,
  remove_tag: CanvasNode,
  move_pipeline_stage: CanvasNode,
  condition: CanvasNode,
  wait: CanvasNode,
  create_task: CanvasNode,
  create_note: CanvasNode,
  create_opportunity: CanvasNode,
  update_contact_field: CanvasNode,
  update_opportunity: CanvasNode,
  assign_contact_to_user: CanvasNode,
  send_notification: CanvasNode,
  webhook: CanvasNode,
  enroll_in_automation: CanvasNode,
  set_event_date: CanvasNode,
  end_workflow: CanvasNode,
  placeholder: PlaceholderNode,
};

const edgeTypes = { insertable: InsertableEdge };

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

function withPlaceholders(
  nodes: AutomationNode[],
  edges: AutomationFlow["edges"],
  onPick: (sourceId: string, branch: string | undefined, type: AutomationNodeType) => void,
  onInsert: (edge: AutomationFlow["edges"][number], type: AutomationNodeType) => void,
  openPicker: (pick: (type: AutomationNodeType) => void) => void,
  counts: Record<string, number>,
  onShowContacts: (nodeId: string) => void,
): { nodes: RFNode[]; edges: RFEdge[] } {
  const phNodes: RFNode[] = [];
  const phEdges: RFEdge[] = [];

  for (const node of nodes) {
    // A node with no outgoing-edge slot (e.g. end_workflow) never gets a placeholder appended.
    if (!NODE_DEFINITIONS[node.type]?.hasSourceHandle) continue;

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
        data: { onOpenPicker: () => openPicker((type) => onPick(node.id, branch, type)) },
        draggable: false,
      });
      phEdges.push({ id: `edge-${phId}`, source: node.id, target: phId, sourceHandle: branch ?? null, type: "smoothstep" });
    }
  }

  return {
    nodes: [
      ...nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: { ...n.data, __contactCount: counts[n.id] ?? 0, __onShowContacts: () => onShowContacts(n.id) },
      })),
      ...phNodes,
    ],
    edges: [
      ...edges.map((e) => ({ ...e, type: "insertable", data: { onOpenPicker: () => openPicker((type) => onInsert(e, type)) } })),
      ...phEdges,
    ],
  };
}

interface AutomationCanvasProps {
  flow: AutomationFlow;
  onChange: (flow: AutomationFlow) => void;
  stages: PipelineStage[];
  automationId?: string;
}

function CanvasInner({ flow, onChange, stages, automationId }: AutomationCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerPick, setPickerPick] = useState<((type: AutomationNodeType) => void) | null>(null);
  const openPicker = useCallback((pick: (type: AutomationNodeType) => void) => setPickerPick(() => pick), []);
  const [contactsPanelNodeId, setContactsPanelNodeId] = useState<string | null>(null);
  const { counts } = useAutomationNodeCounts(automationId, true);
  const handleShowContacts = useCallback((nodeId: string) => setContactsPanelNodeId(nodeId), []);

  // Real (persisted) nodes/edges live here, separate from React Flow's
  // render state below -- this is the source of truth we report upward via
  // onChange, and never carries React Flow's internal `measured`/`selected`
  // bookkeeping fields.
  const [realNodes, setRealNodes] = useState<AutomationNode[]>(flow.nodes);
  const [realEdges, setRealEdges] = useState<AutomationFlow["edges"]>(flow.edges);

  // Undo/redo: a history of {nodes, edges} snapshots taken before each
  // structural edit (add/insert/duplicate/delete/reconfigure). Node dragging
  // isn't tracked here — positions are ephemeral and recomputed by layout().
  const [past, setPast] = useState<AutomationFlow[]>([]);
  const [future, setFuture] = useState<AutomationFlow[]>([]);

  const commit = useCallback(
    (nextNodes: AutomationNode[], nextEdges: AutomationFlow["edges"]) => {
      setPast((prev) => [...prev, { nodes: realNodes, edges: realEdges }].slice(-50));
      setFuture([]);
      setRealNodes(nextNodes);
      setRealEdges(nextEdges);
    },
    [realNodes, realEdges],
  );

  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const last = prevPast[prevPast.length - 1];
      setFuture((prevFuture) => [{ nodes: realNodes, edges: realEdges }, ...prevFuture].slice(0, 50));
      setRealNodes(last.nodes);
      setRealEdges(last.edges);
      setSelectedId(null);
      return prevPast.slice(0, -1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realNodes, realEdges]);

  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const next = prevFuture[0];
      setPast((prevPast) => [...prevPast, { nodes: realNodes, edges: realEdges }].slice(-50));
      setRealNodes(next.nodes);
      setRealEdges(next.edges);
      setSelectedId(null);
      return prevFuture.slice(1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realNodes, realEdges]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (e.key === "y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const handlePick = useCallback((sourceId: string, branch: string | undefined, type: AutomationNodeType) => {
    const newId = crypto.randomUUID();
    const newNode: AutomationNode = { id: newId, type, position: { x: 0, y: 0 }, data: NODE_DEFINITIONS[type].defaultData() };
    const nextEdges = [...realEdges, { id: crypto.randomUUID(), source: sourceId, target: newId, sourceHandle: branch ?? null }];
    commit(layout([...realNodes, newNode], nextEdges), nextEdges);
    setSelectedId(newId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realNodes, realEdges, commit]);

  // Splices a brand-new node into an existing connection: source -> [new node] -> target,
  // so an action can be inserted before/after/between any existing steps, not just appended at a leaf.
  const handleInsertOnEdge = useCallback((edge: AutomationFlow["edges"][number], type: AutomationNodeType) => {
    const newId = crypto.randomUUID();
    const toTarget = { id: crypto.randomUUID(), source: newId, target: edge.target, sourceHandle: type === "condition" ? "yes" : null };
    const fromSource = { id: crypto.randomUUID(), source: edge.source, target: newId, sourceHandle: edge.sourceHandle ?? null };
    const newNode: AutomationNode = { id: newId, type, position: { x: 0, y: 0 }, data: NODE_DEFINITIONS[type].defaultData() };
    const nextEdges = [...realEdges.filter((e) => e.id !== edge.id), fromSource, toTarget];
    commit(layout([...realNodes, newNode], nextEdges), nextEdges);
    setSelectedId(newId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realNodes, realEdges, commit]);

  // Duplicates a single node (its own config only, not its downstream steps —
  // duplicating a whole branch isn't safe here since each node/branch can
  // only have one outgoing connection) and splices the copy in immediately
  // after the original, ahead of whatever it already led to.
  const handleDuplicateNode = useCallback((nodeId: string) => {
    const original = realNodes.find((n) => n.id === nodeId);
    if (!original) return;

    const newId = crypto.randomUUID();
    const copy: AutomationNode = { id: newId, type: original.type, position: { x: 0, y: 0 }, data: { ...original.data } };
    const outgoing = realEdges.find((e) => e.source === nodeId && e.sourceHandle == null);

    let nextEdges: AutomationFlow["edges"];
    if (outgoing) {
      nextEdges = [
        ...realEdges.filter((e) => e.id !== outgoing.id),
        { id: crypto.randomUUID(), source: nodeId, target: newId, sourceHandle: null },
        { id: crypto.randomUUID(), source: newId, target: outgoing.target, sourceHandle: outgoing.sourceHandle ?? null },
      ];
    } else {
      nextEdges = [...realEdges, { id: crypto.randomUUID(), source: nodeId, target: newId, sourceHandle: null }];
    }

    commit(layout([...realNodes, copy], nextEdges), nextEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realNodes, realEdges, commit]);

  // React Flow owns rendering + measurement state. We rebuild the desired
  // node/edge list (real + freshly computed placeholders) whenever the real
  // structure changes and hand it to React Flow's own setters, which merge
  // it against already-measured nodes by id rather than discarding their
  // measured dimensions -- unlike a hand-rolled onNodesChange filter, this
  // never silently drops the "finished measuring, now show it" event.
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<RFNode>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<RFEdge>([]);

  useEffect(() => {
    const { nodes, edges } = withPlaceholders(
      realNodes,
      realEdges,
      handlePick,
      handleInsertOnEdge,
      openPicker,
      counts,
      handleShowContacts,
    );
    setRfNodes(nodes.map((n) => ({ ...n, selected: n.id === selectedId })));
    setRfEdges(edges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realNodes, realEdges, handlePick, handleInsertOnEdge, selectedId, counts, handleShowContacts]);

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
    commit(realNodes.map((n) => (n.id === selectedId ? { ...n, data } : n)), realEdges);
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
    commit(
      realNodes.filter((n) => !toRemove.has(n.id)),
      realEdges.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target)),
    );
    setSelectedId(null);
  }

  function handleDuplicateAndClose() {
    if (!selectedId) return;
    handleDuplicateNode(selectedId);
    setSelectedId(null);
  }

  const memoNodeTypes = useMemo(() => nodeTypes, []);
  const memoEdgeTypes = useMemo(() => edgeTypes, []);

  return (
    <div className="relative h-[70vh] w-full rounded-card border border-border bg-surface-secondary">
      <div className="absolute left-3 top-3 z-10 flex gap-1 rounded-card border border-border bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={undo}
          disabled={past.length === 0}
          title="Undo (Ctrl+Z)"
          className="rounded px-1.5 py-1 text-text-secondary hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Undo2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={future.length === 0}
          title="Redo (Ctrl+Shift+Z)"
          className="rounded px-1.5 py-1 text-text-secondary hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Redo2 className="size-4" />
        </button>
      </div>

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={memoNodeTypes}
        edgeTypes={memoEdgeTypes}
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
          automationId={automationId}
          onClose={() => setSelectedId(null)}
          onSave={handleSaveNode}
          onDelete={handleDeleteNode}
          canDelete={selectedNode.type !== "trigger"}
          onDuplicate={handleDuplicateAndClose}
          canDuplicate={NODE_DEFINITIONS[selectedNode.type].canDuplicate}
        />
      )}

      {pickerPick && (
        <NodePickerPanel
          onPick={(type) => {
            pickerPick(type);
            setPickerPick(null);
          }}
          onClose={() => setPickerPick(null)}
        />
      )}

      {contactsPanelNodeId && automationId && (
        <NodeContactsPanel
          automationId={automationId}
          nodeId={contactsPanelNodeId}
          nodeLabel={NODE_DEFINITIONS[realNodes.find((n) => n.id === contactsPanelNodeId)?.type ?? "trigger"].label}
          onClose={() => setContactsPanelNodeId(null)}
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
