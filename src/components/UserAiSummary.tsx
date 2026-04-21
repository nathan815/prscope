import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  generateUserSummary,
  getCachedSummary,
  type AISummaryResult,
  type UserSummaryContext,
  type AISummaryInput,
} from "../ai/user-summary";

interface PRItem {
  pullRequestId: number;
  title: string;
  status: string;
  sourceRefName: string;
  targetRefName: string;
  creationDate: string;
  repository: { name: string };
  reviewers: { displayName: string; vote: number }[];
}

interface UserAiSummaryProps {
  prs: { created: PRItem[]; reviewed: PRItem[] } | undefined;
  topRepos: { name: string; project: string; created: number; reviewed: number }[] | undefined;
  reviewImpact:
    | {
        totalComments: number;
        avgCommentsPerPr: number;
        approved?: number;
        approvedWithSuggestions?: number;
        rejected?: number;
        waitingForAuthor?: number;
        commentTexts?: { content: string; filePath: string | null }[];
      }
    | undefined;
  userName: string | null;
}

function branchName(ref: string) {
  return ref.replace("refs/heads/", "");
}

function voteLabel(v: number) {
  return v >= 10 ? "approved" : v >= 5 ? "approved w/ suggestions" : v <= -10 ? "rejected" : v <= -5 ? "waiting" : null;
}

function buildContext(
  prs: { created: PRItem[]; reviewed: PRItem[] },
  topRepos: UserAiSummaryProps["topRepos"],
  reviewImpact: UserAiSummaryProps["reviewImpact"],
): UserSummaryContext {
  const topReposText = (topRepos ?? [])
    .slice(0, 10)
    .map((r) => `${r.name} (${r.project}): ${r.created} PRs created, ${r.reviewed} reviewed`)
    .join("\n");

  const formatPR = (pr: PRItem) => {
    const votedReviewers = pr.reviewers
      .filter((r) => r.vote !== 0)
      .map((r) => `${r.displayName} (${voteLabel(r.vote)})`)
      .join(", ");
    const reviewerPart = votedReviewers ? ` | reviewers: ${votedReviewers}` : "";
    return `- [${pr.repository.name}] ${pr.title} (${pr.status}) | ${branchName(pr.sourceRefName)} → ${branchName(pr.targetRefName)}${reviewerPart}`;
  };

  const createdPRs = prs.created.map(formatPR).join("\n");
  const reviewedPRs = prs.reviewed.map(formatPR).join("\n");
  const allPRsText = `Created PRs (${prs.created.length}):\n${createdPRs}\n\nReviewed PRs (${prs.reviewed.length}):\n${reviewedPRs}`;

  const reviewPatterns = reviewImpact
    ? `Across recent reviewed PRs:\n- ${reviewImpact.approved ?? 0} approved, ${reviewImpact.approvedWithSuggestions ?? 0} approved w/ suggestions, ${reviewImpact.waitingForAuthor ?? 0} waiting for author, ${reviewImpact.rejected ?? 0} rejected\n- ${reviewImpact.totalComments} total comments, avg ${reviewImpact.avgCommentsPerPr.toFixed(1)} per PR`
    : "No review data available";

  const comments = reviewImpact?.commentTexts ?? [];
  const sampleComments = comments
    .slice(0, 50)
    .map((c, i) => {
      const path = c.filePath ? `[${c.filePath}] ` : "";
      return `${i + 1}. ${path}${c.content}`;
    })
    .join("\n");

  return {
    topRepos: topReposText || "No repo data",
    recentPRs: allPRsText || "No PR data",
    reviewPatterns,
    sampleComments: sampleComments || "No comments available",
  };
}

function buildInputPRs(prs: { created: PRItem[]; reviewed: PRItem[] }): AISummaryInput["prs"] {
  const all = [...prs.created, ...prs.reviewed];
  const seen = new Set<number>();
  return all
    .filter((pr) => {
      if (seen.has(pr.pullRequestId)) return false;
      seen.add(pr.pullRequestId);
      return true;
    })
    .map((pr) => ({
      id: pr.pullRequestId,
      title: pr.title,
      repo: pr.repository.name,
      creationDate: pr.creationDate,
      status: pr.status,
    }));
}

export function UserAiSummary({ prs, topRepos, reviewImpact, userName }: UserAiSummaryProps) {
  const [result, setResult] = useState<AISummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedCache, setCheckedCache] = useState(false);

  const canGenerate = !!prs && (prs.created.length > 0 || prs.reviewed.length > 0);

  useEffect(() => {
    if (!prs || !canGenerate) return;
    const ctx = buildContext(prs, topRepos, reviewImpact);
    getCachedSummary(ctx).then((cached) => {
      if (cached) setResult(cached);
      setCheckedCache(true);
    });
  }, [prs, topRepos, reviewImpact, canGenerate]);

  const handleGenerate = useCallback(async () => {
    if (!prs) return;
    setLoading(true);
    setError(null);
    try {
      const ctx = buildContext(prs, topRepos, reviewImpact);
      const inputPRs = buildInputPRs(prs);
      const r = await generateUserSummary(ctx, inputPRs);
      setResult(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [prs, topRepos, reviewImpact]);

  const ins = result?.insights;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4" />
        AI Summary
        {userName && (
          <span className="text-[11px] font-normal text-zinc-400">for {userName}</span>
        )}
      </h2>

      {!result && !loading && !error && checkedCache && (
        <div>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="flex items-center gap-2 bg-ado-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-ado-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            Generate Summary
          </button>
          <p className="text-xs text-zinc-400 mt-2">
            Uses GitHub Copilot to analyze PR activity and review patterns.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating summary...
        </div>
      )}

      {error && (
        <div className="space-y-2">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={handleGenerate} className="text-xs text-ado-blue hover:underline">
            Retry
          </button>
        </div>
      )}

      {result && (
        <div>
          {ins && (ins.topAreas.length > 0 || ins.strengths.length > 0) && (
            <div className="mb-5 space-y-4">
              {ins.topAreas.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Focus Areas</h3>
                  <div className="space-y-1.5">
                    {ins.topAreas.map((area) => (
                      <div key={area.name} className="flex items-center gap-2 text-xs">
                        <span className="w-36 shrink-0 text-zinc-600 dark:text-zinc-300">{area.name}</span>
                        <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-4 overflow-hidden">
                          <div className="h-full bg-ado-blue/70 rounded-full transition-all" style={{ width: `${Math.min(area.percentage, 100)}%` }} />
                        </div>
                        <span className="w-10 text-right text-zinc-400">{area.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4 flex-wrap">
                {ins.workStyle && (
                  <div className="flex items-center gap-3">
                    <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Work Style</h3>
                    <span className="text-xs text-ado-blue">{ins.workStyle.created}% creating</span>
                    <span className="text-xs text-zinc-400">·</span>
                    <span className="text-xs text-green-600">{ins.workStyle.reviewed}% reviewing</span>
                  </div>
                )}
                {ins.reviewThoroughness > 0 && (
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Thoroughness</h3>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div key={n} className={`w-3 h-3 rounded-sm ${n <= Math.round(ins.reviewThoroughness) ? 'bg-ado-blue' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                      ))}
                    </div>
                    <span className="text-xs text-zinc-400">{ins.reviewThoroughness.toFixed(1)}/5</span>
                  </div>
                )}
              </div>

              {ins.strengths.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Strengths</h3>
                  <div className="flex flex-wrap gap-2">
                    {ins.strengths.map((s) => (
                      <span key={s} className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {ins.keyCollaborators.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Key Collaborators</h3>
                  <div className="flex flex-wrap gap-2">
                    {ins.keyCollaborators.map((name) => (
                      <span key={name} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2.5 py-1 rounded-full">{name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {result.summary}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex-wrap gap-1">
            <span className="text-[11px] text-zinc-400">
              {(result.input?.prs?.length ?? 0) > 0 && (() => {
                const dates = result.input.prs.map((p) => p.creationDate).sort();
                return `For ${result.input.prs.length} PRs from ${format(new Date(dates[0]!), "MMM d, yyyy")} to ${format(new Date(dates[dates.length - 1]!), "MMM d, yyyy")} · `;
              })()}
              Generated by {result.model} · {format(new Date(result.generatedAt), "MMM d, yyyy h:mm a")}
            </span>
            <button
              onClick={() => { setResult(null); setError(null); handleGenerate(); }}
              className="text-xs text-ado-blue hover:underline"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
