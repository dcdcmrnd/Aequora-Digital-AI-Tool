import type { BlockNode } from "@/lib/site-builder/types";
import { BlockList } from "./BlockRenderer";

/** A generic container block. Phase 2's Columns/etc. block types will join it here. */
export function SectionBlock({ block }: { block: BlockNode }) {
  return (
    <section style={block.style} className="w-full">
      <BlockList blocks={block.children ?? []} />
    </section>
  );
}
