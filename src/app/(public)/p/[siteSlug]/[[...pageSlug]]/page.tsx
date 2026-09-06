import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlockList } from "@/components/site-blocks/BlockRenderer";
import { googleFontsHref } from "@/lib/site-builder/designPresets";
import { parseContent } from "@/lib/site-builder/render";
import { parseThemeTokens, themeTokensToCssVars } from "@/lib/site-builder/theme";
import { prisma } from "@/lib/prisma";

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
        <BlockList blocks={content.blocks} />
      </main>
    </>
  );
}
