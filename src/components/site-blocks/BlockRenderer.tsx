import type { BlockNode } from "@/lib/site-builder/types";
import { SectionBlock } from "./SectionBlock";
import { TextBlock } from "./TextBlock";
import { ButtonBlock } from "./ButtonBlock";
import { ImageBlock } from "./ImageBlock";
import { SpacerBlock } from "./SpacerBlock";
import { VideoBlock } from "./VideoBlock";

/**
 * Single source of truth for "what does a block look like" -- imported by both the public
 * render path and the editor canvas's leaf rendering, so the editor preview can never drift
 * from published output.
 */
export function BlockList({ blocks }: { blocks: BlockNode[] }) {
  return (
    <>
      {blocks.map((block) => (
        <BlockPreview key={block.id} block={block} />
      ))}
    </>
  );
}

export function BlockPreview({ block }: { block: BlockNode }) {
  switch (block.type) {
    case "section":
      return <SectionBlock block={block} />;
    case "text":
      return <TextBlock block={block} />;
    case "button":
      return <ButtonBlock block={block} />;
    case "image":
      return <ImageBlock block={block} />;
    case "spacer":
      return <SpacerBlock block={block} />;
    case "video":
      return <VideoBlock block={block} />;
    default:
      return null;
  }
}
