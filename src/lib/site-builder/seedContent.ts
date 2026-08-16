import crypto from "crypto";

import type { PageContent } from "./types";

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
        style: { padding: "64px 24px", textAlign: "center" },
        children: [
          {
            id: crypto.randomUUID(),
            type: "text",
            props: { html: `<p>Welcome to ${pageTitle}</p>` },
            style: { fontSize: "32px", fontWeight: "700", marginBottom: "12px" },
          },
          {
            id: crypto.randomUUID(),
            type: "text",
            props: { html: "<p>This page was published with the Website Builder.</p>" },
            style: { marginBottom: "24px", color: "#4b5563" },
          },
          {
            id: crypto.randomUUID(),
            type: "button",
            props: { label: "Get Started", href: "#" },
          },
        ],
      },
    ],
  };
}
