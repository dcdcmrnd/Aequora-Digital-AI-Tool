import type { AuditResult, PageSpeedApiResponse } from "./types";

function scoreToPercent(score: number | null | undefined): number | null {
  if (score === null || score === undefined) return null;
  return Math.round(score * 100);
}

export function mapPageSpeedResponse(response: PageSpeedApiResponse): AuditResult {
  const { categories, audits } = response.lighthouseResult;

  const performanceScore = scoreToPercent(categories.performance?.score);
  const seoScore = scoreToPercent(categories.seo?.score);
  const accessibilityScore = scoreToPercent(categories.accessibility?.score);
  const bestPracticesScore = scoreToPercent(categories["best-practices"]?.score);

  const httpsEnabled = audits["is-on-https"]?.score === 1;
  const hasTitle = audits["document-title"]?.score === 1;
  const hasMetaDescription = audits["meta-description"]?.score === 1;
  const mobileFriendly = audits["viewport"]?.score === 1;
  const sslValid = httpsEnabled;

  const speedIndexMs = audits["speed-index"]?.numericValue;
  const pageSpeed = speedIndexMs !== undefined ? Math.round(speedIndexMs) / 1000 : null;

  const scores = [performanceScore, seoScore, accessibilityScore, bestPracticesScore].filter(
    (score): score is number => score !== null,
  );
  const overallScore =
    scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;

  return {
    performanceScore,
    seoScore,
    accessibilityScore,
    bestPracticesScore,
    mobileFriendly,
    httpsEnabled,
    hasMetaDescription,
    hasTitle,
    sslValid,
    pageSpeed,
    overallScore,
  };
}
