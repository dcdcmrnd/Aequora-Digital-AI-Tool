import { describe, expect, it } from "vitest";

import { calculateOpportunityScore, type OpportunityInput } from "./opportunity";

const BASE: OpportunityInput = {
  hasWebsite: true,
  websiteScore: 80,
  performanceScore: 80,
  seoScore: 80,
  httpsEnabled: true,
  rating: 4.0,
  reviewCount: 50,
};

describe("calculateOpportunityScore", () => {
  it("returns 0 for a strong existing web presence with no bonuses", () => {
    expect(calculateOpportunityScore(BASE)).toBe(0);
  });

  it("adds 40 for no website", () => {
    expect(calculateOpportunityScore({ ...BASE, hasWebsite: false, websiteScore: null })).toBe(40);
  });

  it("adds 30 for a website score under 50", () => {
    expect(calculateOpportunityScore({ ...BASE, websiteScore: 49 })).toBe(30);
  });

  it("does not add the website-score penalty at exactly 50", () => {
    expect(calculateOpportunityScore({ ...BASE, websiteScore: 50 })).toBe(0);
  });

  it("adds 10 for performance under 50", () => {
    expect(calculateOpportunityScore({ ...BASE, performanceScore: 49 })).toBe(10);
  });

  it("adds 10 for SEO under 50", () => {
    expect(calculateOpportunityScore({ ...BASE, seoScore: 49 })).toBe(10);
  });

  it("adds 10 for no HTTPS", () => {
    expect(calculateOpportunityScore({ ...BASE, httpsEnabled: false })).toBe(10);
  });

  it("adds 15 for rating over 4.5", () => {
    expect(calculateOpportunityScore({ ...BASE, rating: 4.6 })).toBe(15);
  });

  it("does not add the rating bonus at exactly 4.5", () => {
    expect(calculateOpportunityScore({ ...BASE, rating: 4.5 })).toBe(0);
  });

  it("adds 10 for review count over 100", () => {
    expect(calculateOpportunityScore({ ...BASE, reviewCount: 101 })).toBe(10);
  });

  it("adds a 20 bonus for no website with rating over 4.7", () => {
    expect(
      calculateOpportunityScore({
        ...BASE,
        hasWebsite: false,
        websiteScore: null,
        rating: 4.8,
      }),
    ).toBe(40 + 15 + 20);
  });

  it("does not add the no-website bonus when a website exists, even with a high rating", () => {
    expect(calculateOpportunityScore({ ...BASE, rating: 4.8 })).toBe(15);
  });

  it("caps the total score at 100", () => {
    const worstCase = calculateOpportunityScore({
      hasWebsite: false,
      websiteScore: null,
      performanceScore: 10,
      seoScore: 10,
      httpsEnabled: false,
      rating: 4.9,
      reviewCount: 500,
    });
    expect(worstCase).toBe(100);
  });
});
