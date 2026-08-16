import type { BlockNode } from "@/lib/site-builder/types";

export function SpacerBlock({ block }: { block: BlockNode }) {
  const height = typeof block.props.height === "string" ? block.props.height : "40px";
  return <div style={{ height, ...block.style }} aria-hidden />;
}
