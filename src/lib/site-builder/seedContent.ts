import crypto from "crypto";

import type { PageContent } from "./types";

function escapeHtml(text: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Phase 1 has no drag-and-drop editor yet, so every new Page starts from this same hardcoded
 * demo content instead of a blank canvas -- enough to prove the draft/publish + public
 * rendering pipeline end to end. Phase 2's editor replaces this with a real blank/template start.
 */
export function seedPageContent(pageTitle: string): PageContent {
  return {
    blocks: [
      {
        id: crypto.randomUUID(),
        type: "section",
        props: {},
        style: { padding: "80px 24px", textAlign: "center" },
        children: [
          {
            id: crypto.randomUUID(),
            type: "text",
            // A real <h1> (not a manually-sized <p>) so it picks up .site-content's heading
            // scale in globals.css -- see the "must be improved than GHL" polish pass.
            props: { html: `<h1>Welcome to ${escapeHtml(pageTitle)}</h1><p>This page was published with the Website Builder.</p>` },
            style: { maxWidth: "640px", marginLeft: "auto", marginRight: "auto" },
          },
          {
            id: crypto.randomUUID(),
            type: "button",
            props: { label: "Get Started", href: "#" },
            style: { marginTop: "8px" },
          },
        ],
      },
    ],
  };
}
