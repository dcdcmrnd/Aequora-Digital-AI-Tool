import type { BlockNode } from "./types";

/** Recursively finds a block by id anywhere in the tree. */
export function findBlock(blocks: BlockNode[], id: string): BlockNode | undefined {
  for (const block of blocks) {
    if (block.id === id) return block;
    if (block.children) {
      const found = findBlock(block.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/** Returns a new tree with `id`'s block replaced by `patch(block)`'s result. */
export function updateBlock(blocks: BlockNode[], id: string, patch: (block: BlockNode) => BlockNode): BlockNode[] {
  return blocks.map((block) => {
    if (block.id === id) return patch(block);
    if (block.children) return { ...block, children: updateBlock(block.children, id, patch) };
    return block;
  });
}

/** Returns a new tree with `id`'s block removed, wherever it is. */
export function removeBlock(blocks: BlockNode[], id: string): BlockNode[] {
  return blocks
    .filter((block) => block.id !== id)
    .map((block) => (block.children ? { ...block, children: removeBlock(block.children, id) } : block));
}

/** Appends `newBlock` to the end of `parentId`'s children, or to the root list when parentId is undefined. */
export function appendBlock(blocks: BlockNode[], newBlock: BlockNode, parentId?: string): BlockNode[] {
  if (!parentId) return [...blocks, newBlock];
  return blocks.map((block) => {
    if (block.id === parentId) return { ...block, children: [...(block.children ?? []), newBlock] };
    if (block.children) return { ...block, children: appendBlock(block.children, newBlock, parentId) };
    return block;
  });
}

/** Deep-clones a block subtree with fresh ids, for Duplicate. */
export function cloneWithNewIds(block: BlockNode): BlockNode {
  return {
    ...block,
    id: crypto.randomUUID(),
    children: block.children?.map(cloneWithNewIds),
  };
}

/** Inserts a fresh-id clone of `id`'s block immediately after the original, in whichever list currently holds it. */
export function duplicateBlock(blocks: BlockNode[], id: string): BlockNode[] {
  const index = blocks.findIndex((b) => b.id === id);
  if (index !== -1) {
    const clone = cloneWithNewIds(blocks[index]);
    return [...blocks.slice(0, index + 1), clone, ...blocks.slice(index + 1)];
  }
  return blocks.map((block) => (block.children ? { ...block, children: duplicateBlock(block.children, id) } : block));
}
