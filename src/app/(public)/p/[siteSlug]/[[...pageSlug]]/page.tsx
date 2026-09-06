import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { BlockPreview } from "@/components/site-blocks/BlockRenderer";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { VerifiedReviewsSection } from "@/components/marketing/VerifiedReviewsSection";
import { WhatWeDoSection } from "@/components/marketing/WhatWeDoSection";
import { googleFontsHref } from "@/lib/site-builder/designPresets";
import { parseContent } from "@/lib/site-builder/render";
import { parseThemeTokens, themeTokensToCssVars } from "@/lib/site-builder/theme";
import { prisma } from "@/lib/prisma";
import type { BlockNode } from "@/lib/site-builder/types";

// These two sections are one-off hardcoded overrides for the aequoradigital.com marketing page
// only, not general site-builder block types (the generic block system has no support for
// custom SVG/animation). They're spliced into the block tree below by matching on locked,
// site-specific copy rather than by site/page id, since this render path is shared by every
// client site built with the tool and we have no admin DB access from this environment to look
// up aequoradigital.com's actual site/page ids. If this copy ever changes, these matchers (and
// the splice) need to move or be removed along with it.
function collectBlockText(block: BlockNode, acc: string[]) {
  if (typeof block.props?.html === "string") acc.push(block.props.html);
  if (typeof block.props?.label === "string") acc.push(block.props.label);
  block.children?.forEach((child) => collectBlockText(child, acc));
}

function blockSubtreeIncludesAll(block: BlockNode, markers: string[]): boolean {
  const acc: string[] = [];
  collectBlockText(block, acc);
  // Case-insensitive: an eyebrow like "What We Do" is often stored in natural case and rendered
  // all-caps purely via CSS `uppercase`, so a case-sensitive match on the visible caps would miss it.
  const combined = acc.join(" ").toLowerCase();
  return markers.every((marker) => combined.includes(marker.toLowerCase()));
}

const HOW_IT_WORKS_MARKERS = ["Four steps.", "No surprises."];
const WHO_WE_HELP_MARKERS = ["Who We Help"];
const WHAT_WE_DO_MARKERS = ["WHAT WE DO", "Three layers."];

function renderBlocks(blocks: BlockNode[]) {
  const nodes: ReactNode[] = [];
  for (const block of blocks) {
    if (blockSubtreeIncludesAll(block, WHO_WE_HELP_MARKERS)) {
      nodes.push(<VerifiedReviewsSection key={`${block.id}-verified-reviews`} />);
    }
    if (blockSubtreeIncludesAll(block, WHAT_WE_DO_MARKERS)) {
      nodes.push(<WhatWeDoSection key={block.id} />);
      continue;
    }
    if (blockSubtreeIncludesAll(block, HOW_IT_WORKS_MARKERS)) {
      nodes.push(<HowItWorksSection key={block.id} />);
      continue;
    }
    nodes.push(<BlockPreview key={block.id} block={block} />);
  }
  return nodes;
}

// This route group has no layout (unlike (app)'s, which is the only place that ever calls
// getServerSession) -- it's genuinely public by placement, same posture as the
// track/open/[token] and automations/webhook/[secret] routes: no session check, resolve by
// slug, fail gracefully (404, never throw) rather than leaking an error page.
export const dynamic = "force-dynamic";

interface PageParams {
  params: { siteSlug: string; pageSlug?: string[] };
}

async function findPublishedPage(siteSlug: string, pageSlug?: string[]) {
  const site = await prisma.site.findUnique({ where: { slug: siteSlug } });
  if (!site) return null;

  const slug = pageSlug?.[0];
  const page = slug
    ? await prisma.page.findUnique({ where: { siteId_slug: { siteId: site.id, slug } } })
    : await prisma.page.findFirst({ where: { siteId: site.id, isHomepage: true } });

  if (!page || page.status !== "published") return null;
  return { site, page };
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const found = await findPublishedPage(params.siteSlug, params.pageSlug);
  if (!found) return {};
  const { page } = found;
  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || undefined,
    robots: page.noIndex ? { index: false, follow: false } : undefined,
    openGraph: page.ogImageUrl ? { images: [page.ogImageUrl] } : undefined,
    alternates: page.canonicalUrl ? { canonical: page.canonicalUrl } : undefined,
  };
}

export default async function PublicPage({ params }: PageParams) {
  const found = await findPublishedPage(params.siteSlug, params.pageSlug);
  if (!found) notFound();

  const content = parseContent(found.page.publishedContent);
  const themeTokens = parseThemeTokens(found.site.themeTokens);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- dynamic curated font set (Site Design), not a fixed build-time next/font import */}
      <link rel="stylesheet" href={googleFontsHref()} />
      <main className="site-content mx-auto max-w-5xl" style={themeTokensToCssVars(themeTokens)}>
        {renderBlocks(content.blocks)}
      </main>
    </>
  );
}
