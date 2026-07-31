import { createSeededRandom, randomBool, randomFloat, randomInt } from "@/lib/utils/seeded-random";
import type { AuditResult } from "./types";

interface QualityTier {
  weight: number;
  min: number;
  max: number;
  httpsProbability: number;
  metaProbability: number;
  titleProbability: number;
  mobileProbability: number;
}

const TIERS: QualityTier[] = [
  {
    weight: 0.35,
    min: 15,
    max: 49,
    httpsProbability: 0.5,
    metaProbability: 0.4,
    titleProbability: 0.7,
    mobileProbability: 0.4,
  },
  {
    weight: 0.4,
    min: 50,
    max: 79,
    httpsProbability: 0.85,
    metaProbability: 0.75,
    titleProbability: 0.95,
    mobileProbability: 0.8,
  },
  {
    weight: 0.25,
    min: 80,
    max: 98,
    httpsProbability: 0.98,
    metaProbability: 0.95,
    titleProbability: 1,
    mobileProbability: 0.97,
  },
];

function pickTier(rng: () => number): QualityTier {
  const roll = rng();
  let cumulative = 0;
  for (const tier of TIERS) {
    cumulative += tier.weight;
    if (roll < cumulative) return tier;
  }
  return TIERS[TIERS.length - 1];
}

/**
 * Deterministic per seed — callers pass the website URL (matching
 * lib/audit/mock-client.ts's audit(url)), so the same site always
 * scores the same regardless of which lead references it.
 */
export function generateMockAudit(seed: string): AuditResult {
  const rng = createSeededRandom(seed);
  const tier = pickTier(rng);

  const performanceScore = randomInt(rng, tier.min, tier.max);
  const seoScore = randomInt(rng, tier.min, tier.max);
  const accessibilityScore = randomInt(rng, tier.min, tier.max);
  const bestPracticesScore = randomInt(rng, tier.min, tier.max);
  const httpsEnabled = randomBool(rng, tier.httpsProbability);
  const hasMetaDescription = randomBool(rng, tier.metaProbability);
  const hasTitle = randomBool(rng, tier.titleProbability);
  const mobileFriendly = randomBool(rng, tier.mobileProbability);
  const pageSpeed = randomFloat(rng, 0.8, 6.5, 1);

  const overallScore = Math.round(
    (performanceScore + seoScore + accessibilityScore + bestPracticesScore) / 4,
  );

  return {
    performanceScore,
    seoScore,
    accessibilityScore,
    bestPracticesScore,
    mobileFriendly,
    httpsEnabled,
    hasMetaDescription,
    hasTitle,
    sslValid: httpsEnabled,
    pageSpeed,
    overallScore,
  };
}
