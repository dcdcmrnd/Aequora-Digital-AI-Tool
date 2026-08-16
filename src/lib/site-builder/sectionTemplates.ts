import crypto from "crypto";

import type { BlockNode } from "./types";

function block(type: BlockNode["type"], props: Record<string, unknown> = {}, style?: Record<string, string>, children?: BlockNode[]): BlockNode {
  return { id: crypto.randomUUID(), type, props, style, children };
}

function column(widthPercent: number, children: BlockNode[]): BlockNode {
  return block("column", { widthPercent }, undefined, children);
}

export interface SectionTemplate {
  id: string;
  label: string;
  category: "Intro" | "Content" | "Social Proof" | "Conversion";
  /** A small CSS-mockup schematic, not a rendered screenshot -- see SectionTemplatePicker.tsx. */
  mockup: "hero" | "features" | "textImage" | "testimonial" | "cta";
  build: () => BlockNode;
}

export const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    id: "hero",
    label: "Hero",
    category: "Intro",
    mockup: "hero",
    build: () =>
      block("section", {}, { padding: "96px 24px", textAlign: "center" }, [
        block("text", { html: "<h1>Your headline goes here</h1><p>A short subheading that explains what you offer and why it matters.</p>" }, { maxWidth: "640px", marginLeft: "auto", marginRight: "auto" }),
        block("button", { label: "Get Started", href: "#" }, { marginTop: "8px" }),
      ]),
  },
  {
    id: "features",
    label: "Feature Grid",
    category: "Content",
    mockup: "features",
    build: () =>
      block("section", {}, { padding: "80px 24px" }, [
        block("text", { html: "<h2>Why choose us</h2>" }, { textAlign: "center", marginBottom: "16px" }),
        block("columns", {}, undefined, [
          column(33.33, [block("text", { html: "<h3>Feature One</h3><p>Describe the benefit in a sentence or two.</p>" })]),
          column(33.33, [block("text", { html: "<h3>Feature Two</h3><p>Describe the benefit in a sentence or two.</p>" })]),
          column(33.33, [block("text", { html: "<h3>Feature Three</h3><p>Describe the benefit in a sentence or two.</p>" })]),
        ]),
      ]),
  },
  {
    id: "textImage",
    label: "Text + Image",
    category: "Content",
    mockup: "textImage",
    build: () =>
      block("section", {}, { padding: "80px 24px" }, [
        block("columns", {}, undefined, [
          column(50, [block("text", { html: "<h2>Tell your story</h2><p>Use this space to describe your product, service, or team. Replace this text and the image alongside it.</p>" })]),
          column(50, [block("image", { src: "", alt: "" })]),
        ]),
      ]),
  },
  {
    id: "testimonial",
    label: "Testimonial",
    category: "Social Proof",
    mockup: "testimonial",
    build: () =>
      block("section", {}, { padding: "80px 24px", textAlign: "center" }, [
        block(
          "text",
          { html: '<p>"This is where a great customer quote goes — something that speaks to the results you deliver."</p><p>Customer Name, Company</p>' },
          { maxWidth: "560px", marginLeft: "auto", marginRight: "auto", fontSize: "20px" },
        ),
      ]),
  },
  {
    id: "cta",
    label: "Call to Action",
    category: "Conversion",
    mockup: "cta",
    build: () =>
      block("section", {}, { padding: "72px 24px", textAlign: "center", backgroundColor: "var(--site-color-primary, #111827)", color: "#ffffff" }, [
        block("text", { html: "<h2>Ready to get started?</h2>" }, { marginBottom: "8px" }),
        block("button", { label: "Contact Us", href: "#" }, { backgroundColor: "#ffffff", color: "var(--site-color-primary, #111827)" }),
      ]),
  },
];
