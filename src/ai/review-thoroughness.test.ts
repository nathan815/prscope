import { describe, it, expect } from "vitest";
import { computeReviewThoroughness } from "./review-thoroughness";

describe("computeReviewThoroughness", () => {
  it("returns 0 when no PRs analyzed", () => {
    expect(
      computeReviewThoroughness({
        avgCommentsPerPr: 0,
        approvalsWithComments: 0,
        approvalsWithoutComments: 0,
        waitingForAuthor: 0,
        rejected: 0,
        totalPrsAnalyzed: 0,
      }),
    ).toBe(0);
  });

  it("scores low for rubber-stamp reviews (no comments, all straight approvals)", () => {
    const score = computeReviewThoroughness({
      avgCommentsPerPr: 0,
      approvalsWithComments: 0,
      approvalsWithoutComments: 20,
      waitingForAuthor: 0,
      rejected: 0,
      totalPrsAnalyzed: 20,
    });
    expect(score).toBe(1);
  });

  it("scores mid-range for moderate commenting with some commented approvals", () => {
    const score = computeReviewThoroughness({
      avgCommentsPerPr: 1.5,
      approvalsWithComments: 10,
      approvalsWithoutComments: 10,
      waitingForAuthor: 0,
      rejected: 0,
      totalPrsAnalyzed: 20,
    });
    expect(score).toBeGreaterThan(2);
    expect(score).toBeLessThan(4);
  });

  it("scores high for heavy commenting, mostly commented approvals, and uses strong signals", () => {
    const score = computeReviewThoroughness({
      avgCommentsPerPr: 5,
      approvalsWithComments: 18,
      approvalsWithoutComments: 2,
      waitingForAuthor: 3,
      rejected: 1,
      totalPrsAnalyzed: 20,
    });
    expect(score).toBeGreaterThanOrEqual(4.5);
    expect(score).toBeLessThanOrEqual(5);
  });

  it("gives credit for using waiting/rejected even with low comments", () => {
    const withSignals = computeReviewThoroughness({
      avgCommentsPerPr: 0.5,
      approvalsWithComments: 5,
      approvalsWithoutComments: 15,
      waitingForAuthor: 2,
      rejected: 0,
      totalPrsAnalyzed: 20,
    });
    const withoutSignals = computeReviewThoroughness({
      avgCommentsPerPr: 0.5,
      approvalsWithComments: 5,
      approvalsWithoutComments: 15,
      waitingForAuthor: 0,
      rejected: 0,
      totalPrsAnalyzed: 20,
    });
    expect(withSignals).toBeGreaterThan(withoutSignals);
  });

  it("caps comment depth contribution at 4+ avg comments", () => {
    const at4 = computeReviewThoroughness({
      avgCommentsPerPr: 4,
      approvalsWithComments: 0,
      approvalsWithoutComments: 10,
      waitingForAuthor: 0,
      rejected: 0,
      totalPrsAnalyzed: 10,
    });
    const at10 = computeReviewThoroughness({
      avgCommentsPerPr: 10,
      approvalsWithComments: 0,
      approvalsWithoutComments: 10,
      waitingForAuthor: 0,
      rejected: 0,
      totalPrsAnalyzed: 10,
    });
    expect(at4).toBe(at10);
  });

  it("returns score between 1 and 5 inclusive", () => {
    const scenarios = [
      {
        avgCommentsPerPr: 0,
        approvalsWithComments: 0,
        approvalsWithoutComments: 1,
        waitingForAuthor: 0,
        rejected: 0,
        totalPrsAnalyzed: 1,
      },
      {
        avgCommentsPerPr: 2,
        approvalsWithComments: 5,
        approvalsWithoutComments: 5,
        waitingForAuthor: 1,
        rejected: 0,
        totalPrsAnalyzed: 10,
      },
      {
        avgCommentsPerPr: 10,
        approvalsWithComments: 10,
        approvalsWithoutComments: 0,
        waitingForAuthor: 5,
        rejected: 5,
        totalPrsAnalyzed: 10,
      },
    ];
    for (const s of scenarios) {
      const score = computeReviewThoroughness(s);
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(5);
    }
  });
});
