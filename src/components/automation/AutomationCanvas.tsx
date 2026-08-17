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
import { ClipboardPaste, Redo2, Undo2, X } from "lucide-react";
import toast from "react-hot-toast";

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
  split: CanvasNode,
  wait: CanvasNode,
  create_task: CanvasNode,
  create_note: CanvasNode,
  create_opportunity: CanvasNode,
  ai_prompt: CanvasNode,
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

interface NodeMenuActions {
  onCopyNode: (nodeId: string) => void;
  onCopySubtree: (nodeId: string) => void;
  onMoveNode: (nodeId: string) => void;
  onMoveSubtree: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteSubtree: (nodeId: string) => void;
}

function collectSubtreeIds(nodeId: string, edges: AutomationFlow["edges"]): string[] {
  const ids: string[] = [];
  function walk(id: string) {
    ids.push(id);
    edges.filter((e) => e.source === id).forEach((e) => walk(e.target));
  }
  walk(nodeId);
  return ids;
}

/** A detached node-or-subtree awaiting placement -- built once (at Copy/Move time) and spliced in wherever the user next clicks a "+". */
interface Chunk {
  nodes: AutomationNode[];
  internalEdges: AutomationFlow["edges"];
  /** Receives the incoming connection from whatever destination is chosen. */
  rootId: string;
  /** Dead-ends within the chunk -- each receives the destination's outgoing connection, if any. */
  leafIds: string[];
}

interface Clipboard {
  mode: "copy" | "move";
  chunk: Chunk;
}

type PasteDestination = { sourceId: string; branch: string | null } | { edge: AutomationFlow["edges"][number] };

function withPlaceholders(
  nodes: AutomationNode[],
  edges: AutomationFlow["edges"],
  onPick: (sourceId: string, branch: string | undefined, type: AutomationNodeType) => void,
  onInsert: (edge: AutomationFlow["edges"][number], type: AutomationNodeType) => void,
  openPicker: (pick: (type: AutomationNodeType) => void) => void,
  counts: Record<string, number>,
  onShowContacts: (nodeId: string) => void,
  menuActions: NodeMenuActions,
  clipboard: Clipboard | null,
  onApplyClipboard: (destination: PasteDestination) => void,
): { nodes: RFNode[]; edges: RFEdge[] } {
  const phNodes: RFNode[] = [];
  const phEdges: RFEdge[] = [];
  const pasting = !!clipboard;

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
        data: {
          pasting,
          onOpenPicker: pasting
            ? () => onApplyClipboard({ sourceId: node.id, branch: branch ?? null })
            : () => openPicker((type) => onPick(node.id, branch, type)),
        },
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
        data: {
          ...n.data,
          __contactCount: counts[n.id] ?? 0,
          __onShowContacts: () => onShowContacts(n.id),
          __onCopyNode: () => menuActions.onCopyNode(n.id),
          __onCopySubtree: () => menuActions.onCopySubtree(n.id),
          __onMoveNode: () => menuActions.onMoveNode(n.id),
          __onMoveSubtree: () => menuActions.onMoveSubtree(n.id),
          __onDeleteNode: () => menuActions.onDeleteNode(n.id),
          __onDeleteSubtree: () => menuActions.onDeleteSubtree(n.id),
        },
      })),
      ...phNodes,
    ],
    edges: [
      ...edges.map((e) => ({
        ...e,
        type: "insertable",
        data: {
          pasting,
          onOpenPicker: pasting ? () => onApplyClipboard({ edge: e }) : () => openPicker((type) => onInsert(e, type)),
        },
      })),
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

  // A pending Copy/Move awaiting where to place it -- unlike the old
  // behavior, populating this never touches the graph by itself; only
  // clicking a "+" (now repurposed as a paste target while this is set,
  // see withPlaceholders) actually splices it in. Cleared by applying it,
  // pressing Escape, or undo/redo (which can invalidate the ids it refers to).
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);

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
      setClipboard(null);
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
      setClipboard(null);
      return prevFuture.slice(1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realNodes, realEdges]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setClipboard(null);
        return;
      }
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

  // Duplicates a node AND its entire downstream chain (including nested
  // branches), splicing the whole copy in immediately after the original --
  // every dead-end in the copy reconnects to whatever the original already
  // led to, extending the single-node "Copy action" convention above to a
  // whole subtree. Not offered for branching (condition) nodes: a condition
  // has two outgoing edges, so there's no single "next step" to splice the
  // copy's own two branches back into.
  const handleCopySubtree = useCallback((nodeId: string) => {
    const idsToCopy: string[] = [];
    function collect(id: string) {
      idsToCopy.push(id);
      realEdges.filter((e) => e.source === id).forEach((e) => collect(e.target));
    }
    collect(nodeId);

    const idMap = new Map(idsToCopy.map((id) => [id, crypto.randomUUID()]));
    const copiedNodes: AutomationNode[] = idsToCopy.map((id) => {
      const original = realNodes.find((n) => n.id === id)!;
      return { id: idMap.get(id)!, type: original.type, position: { x: 0, y: 0 }, data: { ...original.data } };
    });

    // Edges fully inside the copied subtree get remapped to the new ids so
    // nested branches (e.g. a condition partway down the chain) are preserved.
    const internalEdges = realEdges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e) => ({
        id: crypto.randomUUID(),
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
        sourceHandle: e.sourceHandle ?? null,
      }));

    // Every dead-end in the copied subtree (a node with no outgoing edge at
    // all -- there can be more than one if a nested condition branches)
    // reconnects to whatever the original top-level node already led to.
    const originalOutgoing = realEdges.find((e) => e.source === nodeId && e.sourceHandle == null);
    const leafOriginalIds = idsToCopy.filter((id) => !realEdges.some((e) => e.source === id));
    const reconnectEdges = originalOutgoing
      ? leafOriginalIds.map((leafId) => ({
          id: crypto.randomUUID(),
          source: idMap.get(leafId)!,
          target: originalOutgoing.target,
          sourceHandle: null,
        }))
      : [];

    const rootCopyId = idMap.get(nodeId)!;
    const rootEdge = { id: crypto.randomUUID(), source: nodeId, target: rootCopyId, sourceHandle: null };

    const nextEdges = originalOutgoing
      ? [...realEdges.filter((e) => e.id !== originalOutgoing.id), rootEdge, ...internalEdges, ...reconnectEdges]
      : [...realEdges, rootEdge, ...internalEdges];

    commit(layout([...realNodes, ...copiedNodes], nextEdges), nextEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realNodes, realEdges, commit]);

  // Builds a detached chunk from a node (optionally + its downstream chain)
  // without touching the live graph -- `keepIds` is false for Copy (fresh
  // ids, since the original stays put right next to the new copy) and true
  // for Move (same ids, since it's the same node relocating, not a
  // duplicate). This is the shared basis for both "Copy"/"Copy below" and
  // "Move"/"Move below": what used to auto-splice immediately after the
  // source now just gets captured for placement wherever the user clicks a
  // "+" next (see applyClipboardAt).
  const buildChunk = useCallback(
    (nodeId: string, includeSubtree: boolean, keepIds: boolean): Chunk => {
      const ids = includeSubtree ? collectSubtreeIds(nodeId, realEdges) : [nodeId];
      const idMap = new Map(ids.map((id) => [id, keepIds ? id : crypto.randomUUID()]));
      const nodes = ids.map((id) => {
        const original = realNodes.find((n) => n.id === id)!;
        return { id: idMap.get(id)!, type: original.type, position: { x: 0, y: 0 }, data: { ...original.data } };
      });
      const internalEdges = realEdges
        .filter((e) => idMap.has(e.source) && idMap.has(e.target))
        .map((e) => ({
          id: crypto.randomUUID(),
          source: idMap.get(e.source)!,
          target: idMap.get(e.target)!,
          sourceHandle: e.sourceHandle ?? null,
        }));
      const leafIds = ids.filter((id) => !realEdges.some((e) => e.source === id)).map((id) => idMap.get(id)!);
      return { nodes, internalEdges, rootId: idMap.get(nodeId)!, leafIds };
    },
    [realNodes, realEdges],
  );

  const handleCopyNodeToClipboard = useCallback(
    (nodeId: string) => setClipboard({ mode: "copy", chunk: buildChunk(nodeId, false, false) }),
    [buildChunk],
  );
  const handleCopySubtreeToClipboard = useCallback(
    (nodeId: string) => setClipboard({ mode: "copy", chunk: buildChunk(nodeId, true, false) }),
    [buildChunk],
  );
  const handleMoveNodeToClipboard = useCallback(
    (nodeId: string) => setClipboard({ mode: "move", chunk: buildChunk(nodeId, false, true) }),
    [buildChunk],
  );
  const handleMoveSubtreeToClipboard = useCallback(
    (nodeId: string) => setClipboard({ mode: "move", chunk: buildChunk(nodeId, true, true) }),
    [buildChunk],
  );

  // Splices the pending clipboard chunk in at `destination`. For a Move,
  // first cuts the chunk's nodes out of their current spot in the *same*
  // commit -- a single-node move bridges its old incoming/outgoing edges
  // together (chain keeps running without it, mirroring handleDeleteSingleNode);
  // a subtree move just drops all edges touching the removed set, leaving a
  // fresh dead-end there (mirroring handleDeleteSubtree). One commit means
  // one undo step reverts the whole move, not two.
  const applyClipboardAt = useCallback(
    (destination: PasteDestination) => {
      if (!clipboard) return;
      const { chunk, mode } = clipboard;
      const chunkIds = new Set(chunk.nodes.map((n) => n.id));

      const targetTouchesChunk =
        "edge" in destination
          ? chunkIds.has(destination.edge.source) || chunkIds.has(destination.edge.target)
          : chunkIds.has(destination.sourceId);
      if (targetTouchesChunk) {
        toast.error("Can't drop an action into the part being moved.");
        return;
      }

      let nodes = realNodes;
      let edges = realEdges;

      if (mode === "move") {
        if (chunk.nodes.length === 1) {
          const nodeId = chunk.nodes[0].id;
          const incoming = edges.filter((e) => e.target === nodeId);
          const outgoing = edges.filter((e) => e.source === nodeId);
          const bridgeEdges = incoming.flatMap((inEdge) =>
            outgoing.map((outEdge) => ({
              id: crypto.randomUUID(),
              source: inEdge.source,
              target: outEdge.target,
              sourceHandle: inEdge.sourceHandle ?? null,
            })),
          );
          edges = [...edges.filter((e) => e.target !== nodeId && e.source !== nodeId), ...bridgeEdges];
        } else {
          edges = edges.filter((e) => !chunkIds.has(e.source) && !chunkIds.has(e.target));
        }
        nodes = nodes.filter((n) => !chunkIds.has(n.id));
      }

      let nextEdges: AutomationFlow["edges"];
      if ("edge" in destination) {
        const edge = destination.edge;
        const rootEdge = { id: crypto.randomUUID(), source: edge.source, target: chunk.rootId, sourceHandle: edge.sourceHandle ?? null };
        const leafEdges = chunk.leafIds.map((leafId) => ({ id: crypto.randomUUID(), source: leafId, target: edge.target, sourceHandle: null }));
        nextEdges = [...edges.filter((e) => e.id !== edge.id), rootEdge, ...chunk.internalEdges, ...leafEdges];
      } else {
        const rootEdge = { id: crypto.randomUUID(), source: destination.sourceId, target: chunk.rootId, sourceHandle: destination.branch };
        nextEdges = [...edges, rootEdge, ...chunk.internalEdges];
      }

      commit(layout([...nodes, ...chunk.nodes], nextEdges), nextEdges);
      setClipboard(null);
    },
    [clipboard, realNodes, realEdges, commit],
  );

  // Removes just one node, reconnecting its incoming edge(s) straight to its
  // outgoing edge's target so the rest of the chain keeps running --
  // deleting a single step should never take its downstream actions with it.
  // Not offered for branching (condition) nodes: with two outgoing edges,
  // reconnecting a single incoming edge to both would make one branch
  // unreachable (the engine only ever follows the first matching edge for a
  // given handle), so those must go through handleDeleteSubtree instead.
  const handleDeleteSingleNode = useCallback((nodeId: string) => {
    const incoming = realEdges.filter((e) => e.target === nodeId);
    const outgoing = realEdges.filter((e) => e.source === nodeId);

    const bridgeEdges = incoming.flatMap((inEdge) =>
      outgoing.map((outEdge) => ({
        id: crypto.randomUUID(),
        source: inEdge.source,
        target: outEdge.target,
        sourceHandle: inEdge.sourceHandle ?? null,
      })),
    );

    const nextEdges = [...realEdges.filter((e) => e.target !== nodeId && e.source !== nodeId), ...bridgeEdges];
    const nextNodes = realNodes.filter((n) => n.id !== nodeId);

    commit(layout(nextNodes, nextEdges), nextEdges);
    setSelectedId((prev) => (prev === nodeId ? null : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realNodes, realEdges, commit]);

  // Deletes a node and everything downstream of it -- the previous default
  // (and only) delete behavior, kept as an explicit "Delete all actions" choice.
  const handleDeleteSubtree = useCallback((nodeId: string) => {
    const toRemove = new Set<string>();
    function collect(id: string) {
      toRemove.add(id);
      realEdges.filter((e) => e.source === id).forEach((e) => collect(e.target));
    }
    collect(nodeId);
    commit(
      realNodes.filter((n) => !toRemove.has(n.id)),
      realEdges.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target)),
    );
    setSelectedId((prev) => (prev && toRemove.has(prev) ? null : prev));
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

  const menuActions = useMemo<NodeMenuActions>(
    () => ({
      onCopyNode: handleCopyNodeToClipboard,
      onCopySubtree: handleCopySubtreeToClipboard,
      onMoveNode: handleMoveNodeToClipboard,
      onMoveSubtree: handleMoveSubtreeToClipboard,
      onDeleteNode: handleDeleteSingleNode,
      onDeleteSubtree: handleDeleteSubtree,
    }),
    [handleCopyNodeToClipboard, handleCopySubtreeToClipboard, handleMoveNodeToClipboard, handleMoveSubtreeToClipboard, handleDeleteSingleNode, handleDeleteSubtree],
  );

  useEffect(() => {
    const { nodes, edges } = withPlaceholders(
      realNodes,
      realEdges,
      handlePick,
      handleInsertOnEdge,
      openPicker,
      counts,
      handleShowContacts,
      menuActions,
      clipboard,
      applyClipboardAt,
    );
    setRfNodes(nodes.map((n) => ({ ...n, selected: n.id === selectedId })));
    setRfEdges(edges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realNodes, realEdges, handlePick, handleInsertOnEdge, selectedId, counts, handleShowContacts, menuActions, clipboard, applyClipboardAt]);

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

  // The side panel's single "Delete" button: safe single-node delete for
  // ordinary steps, falls back to subtree delete for condition nodes (see
  // handleDeleteSingleNode for why single delete isn't safe there).
  function handleDeleteSelected() {
    if (!selectedId) return;
    const node = realNodes.find((n) => n.id === selectedId);
    if (node && NODE_DEFINITIONS[node.type].isBranching) {
      handleDeleteSubtree(selectedId);
    } else {
      handleDeleteSingleNode(selectedId);
    }
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

      {clipboard && (
        <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-card border border-brand-primary bg-white py-1.5 pl-3 pr-1.5 text-xs font-medium text-text-primary shadow-sm">
          <ClipboardPaste className="size-3.5 text-brand-primary" />
          {clipboard.mode === "move" ? "Moving" : "Copying"} {clipboard.chunk.nodes.length}{" "}
          {clipboard.chunk.nodes.length === 1 ? "action" : "actions"} — click a + where it should go
          <button
            type="button"
            onClick={() => setClipboard(null)}
            title="Cancel (Esc)"
            className="text-text-muted hover:bg-surface-secondary hover:text-text-primary rounded p-1"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

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
          onDelete={handleDeleteSelected}
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
