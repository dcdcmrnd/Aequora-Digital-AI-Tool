import { SECTION_TEMPLATES } from "./sectionTemplates";
import type { PageContent } from "./types";

function escapeHtml(text: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Every new Page starts from the Hero section template (customized with the page's own title)
 * rather than a bespoke hardcoded shape -- one "default starting content" concept, not two, now
 * that section templates exist. See sectionTemplates.ts.
 */
export function seedPageContent(pageTitle: string): PageContent {
  const hero = SECTION_TEMPLATES.find((t) => t.id === "hero")!.build();
  const heading = hero.children?.[0];
  if (heading) {
    heading.props.html = `<h1>Welcome to ${escapeHtml(pageTitle)}</h1><p>This page was published with the Website Builder.</p>`;
  }
  return { blocks: [hero] };
}
