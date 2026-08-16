import type { BlockNode } from "@/lib/site-builder/types";

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return url;
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes("vimeo.com")) {
      if (u.hostname.includes("player.vimeo.com")) return url;
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function VideoBlock({ block }: { block: BlockNode }) {
  const url = typeof block.props.url === "string" ? block.props.url : "";
  const embedUrl = url ? toEmbedUrl(url) : null;

  if (!embedUrl) {
    return (
      <div style={block.style} className="flex aspect-video w-full items-center justify-center rounded-md bg-gray-100 text-sm text-gray-400">
        {url ? "Couldn't recognize that video URL" : "No video URL set"}
      </div>
    );
  }

  return (
    <div style={block.style} className="aspect-video w-full overflow-hidden rounded-md">
      <iframe src={embedUrl} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
    </div>
  );
}
