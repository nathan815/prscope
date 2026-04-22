/**
 * Computes a review thoroughness score from 1-5 based on observable metrics.
 *
 * Factors:
 * - Average comments per reviewed PR (0-5+ scale)
 * - % of approvals that had comments before sign-off
 * - Whether the reviewer ever uses "waiting for author" or "rejected"
 *
 * Returns 0 if no reviews to analyze.
 */
export interface ReviewMetrics {
  totalPrsAnalyzed: number;
  avgCommentsPerPr: number;
  approvalsWithComments?: number;
  approvalsWithoutComments?: number;
  waitingForAuthor?: number;
  rejected?: number;
}

export function computeReviewThoroughness(metrics: ReviewMetrics): number {
  if (metrics.totalPrsAnalyzed === 0) return 0;

  const approvalsWithComments = metrics.approvalsWithComments ?? 0;
  const approvalsWithoutComments = metrics.approvalsWithoutComments ?? 0;
  const waitingForAuthor = metrics.waitingForAuthor ?? 0;
  const rejected = metrics.rejected ?? 0;

  const totalApprovals = approvalsWithComments + approvalsWithoutComments;
  const commentedApprovalRate = totalApprovals > 0 ? approvalsWithComments / totalApprovals : 0;

  const commentDepth = Math.min(metrics.avgCommentsPerPr / 4, 1);
  const usesStrongSignals = waitingForAuthor + rejected > 0 ? 1 : 0;

  const raw = commentDepth * 0.5 + commentedApprovalRate * 0.35 + usesStrongSignals * 0.15;

  return Math.round((1 + raw * 4) * 10) / 10;
}
