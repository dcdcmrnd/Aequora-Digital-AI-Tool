import type { BlockNode } from "@/lib/site-builder/types";

export function ButtonBlock({ block }: { block: BlockNode }) {
  const label = typeof block.props.label === "string" ? block.props.label : "Click here";
  const href = typeof block.props.href === "string" ? block.props.href : "#";
  return (
    <a
      href={href}
      style={block.style}
      className="inline-block rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700"
    >
      {label}
    </a>
  );
}
