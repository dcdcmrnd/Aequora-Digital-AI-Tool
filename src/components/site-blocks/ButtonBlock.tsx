import type { BlockNode } from "@/lib/site-builder/types";

export function ButtonBlock({ block }: { block: BlockNode }) {
  const label = typeof block.props.label === "string" ? block.props.label : "Click here";
  const href = typeof block.props.href === "string" ? block.props.href : "#";
  return (
    <a
      href={href}
      style={block.style}
      className="inline-block rounded-md bg-[var(--site-color-primary,#111827)] px-6 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
    >
      {label}
    </a>
  );
}
