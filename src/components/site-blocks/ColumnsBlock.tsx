import type { BlockNode } from "@/lib/site-builder/types";
import { BlockList } from "./BlockRenderer";

export function ColumnsBlock({ block }: { block: BlockNode }) {
  return (
    <div style={block.style} className="flex w-full flex-col gap-6 md:flex-row">
      <BlockList blocks={block.children ?? []} />
    </div>
  );
}

export function ColumnBlock({ block }: { block: BlockNode }) {
  const widthPercent = typeof block.props.widthPercent === "number" ? block.props.widthPercent : 50;
  return (
    <div style={{ ...block.style, flexBasis: `${widthPercent}%` }} className="min-w-0 flex-1">
      <BlockList blocks={block.children ?? []} />
    </div>
  );
}
