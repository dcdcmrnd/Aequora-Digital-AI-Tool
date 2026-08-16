import { EMPTY_PAGE_CONTENT, type PageContent } from "./types";

/** Parses a Page's draftContent/publishedContent JSON string, same parse-with-fallback shape as automation's parseFlow(). */
export function parseContent(contentJson: string | null | undefined): PageContent {
  if (!contentJson) return EMPTY_PAGE_CONTENT;
  try {
    const parsed = JSON.parse(contentJson);
    return { blocks: parsed.blocks ?? [] };
  } catch {
    return EMPTY_PAGE_CONTENT;
  }
}
