import type { BlockNode } from "@/lib/site-builder/types";

// Content is authored via RichTextEditor.tsx (TipTap) by staff with "sites.manage" -- same
// trust boundary as email bodies elsewhere in this app (also TipTap HTML, also rendered
// unsanitized). Unlike email, a published page is public/indexed, so if site editing is ever
// opened up beyond trusted internal staff, this needs sanitizing (e.g. DOMPurify) first.
export function TextBlock({ block }: { block: BlockNode }) {
  const html = typeof block.props.html === "string" ? block.props.html : "";
  return <div style={block.style} className="site-content" dangerouslySetInnerHTML={{ __html: html }} />;
}
