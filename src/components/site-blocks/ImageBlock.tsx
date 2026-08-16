import NextImage from "next/image";

import type { BlockNode } from "@/lib/site-builder/types";

// Uses next/image (auto image optimization) whenever we know the intrinsic size -- captured at
// upload time in BlockConfigPanel.tsx and stored as width/height props -- rather than a plain
// <img>, which is one of this builder's concrete "leaner than GHL" differentiators (see plan).
// Falls back to a plain <img> if size isn't known (e.g. content authored before this existed).
export function ImageBlock({ block }: { block: BlockNode }) {
  const src = typeof block.props.src === "string" ? block.props.src : "";
  const alt = typeof block.props.alt === "string" ? block.props.alt : "";
  const width = typeof block.props.width === "number" ? block.props.width : undefined;
  const height = typeof block.props.height === "number" ? block.props.height : undefined;

  if (!src) {
    return (
      <div style={block.style} className="flex h-40 w-full items-center justify-center rounded-md bg-gray-100 text-sm text-gray-400">
        No image selected
      </div>
    );
  }

  if (width && height) {
    return (
      <NextImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        style={{ width: "100%", height: "auto", ...block.style }}
      />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element -- no known intrinsic size to give next/image
  return <img src={src} alt={alt} style={block.style} className="max-w-full" />;
}
