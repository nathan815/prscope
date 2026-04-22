import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import {
  generateUserSummary,
  getCachedSummary,
  type AISummaryResult,
  type AISummaryInput,
} from "../ai/user-summary";
import { computeReviewThoroughness } from "../ai/review-thoroughness";

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
        totalPrsAnalyzed: number;
        totalComments: number;
        avgCommentsPerPr: number;
        approved?: number;
        approvedWithSuggestions?: number;
        approvalsWithComments?: number;
        approvalsWithoutComments?: number;
        rejected?: number;
        waitingForAuthor?: number;
        commentTexts?: { content: string; filePath: string | null }[];
      }
    | undefined;
  userName: string | null;
  userImageUrl: string | null;
  userId: string;
  timeRange: string;
  fetchLimit: number;
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

export function UserAiSummary({ prs, topRepos, reviewImpact, userName, userImageUrl, userId, timeRange, fetchLimit }: UserAiSummaryProps) {
  const [result, setResult] = useState<AISummaryResult | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedCache, setCheckedCache] = useState(false);

  const canGenerate = !!prs && (prs.created.length > 0 || prs.reviewed.length > 0);

  useEffect(() => {
    if (!canGenerate) return;
    setResult(null);
    setIsStale(false);
    setCheckedCache(false);
    getCachedSummary(userId, timeRange, fetchLimit).then((cached) => {
      if (cached) {
        setResult(cached.result);
        setIsStale(!cached.exact);
      }
      setCheckedCache(true);
    });
  }, [userId, timeRange, fetchLimit, canGenerate]);

  const handleGenerate = useCallback(async (skipCache = false) => {
    if (!prs) return;
    setLoading(true);
    setError(null);
    try {
      const ctx = {
        userName: userName ?? "Unknown",
        topRepos: topRepos ?? [],
        createdPRs: prs.created,
        reviewedPRs: prs.reviewed,
        reviewImpact,
      };
      const inputPRs = buildInputPRs(prs);
      const r = await generateUserSummary(ctx, inputPRs, { userId, timeRange, fetchLimit }, skipCache);
      setResult(r);
      setIsStale(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [prs, topRepos, reviewImpact, userId, timeRange, fetchLimit]);

  const ins = result?.insights;
  const thoroughness = result?.reviewThoroughness
    ?? (reviewImpact ? computeReviewThoroughness(reviewImpact) : 0);

  const [copied, setCopied] = useState(false);
  const copyAsMarkdown = () => {
    if (!result) return;
    const lines: string[] = [];
    lines.push(`# AI Summary — ${userName ?? 'Engineer'}\n`);
    if (ins) {
      if (ins.topAreas.length > 0) {
        lines.push('## Focus Areas\n');
        ins.topAreas.forEach((a) => lines.push(`- **${a.name}**: ${a.percentage}%`));
        lines.push('');
      }
      if (ins.workStyle) {
        lines.push(`## Work Style\n`);
        lines.push(`- Creating: ${ins.workStyle.created}%`);
        lines.push(`- Reviewing: ${ins.workStyle.reviewed}%`);
        lines.push('');
      }
      if (thoroughness > 0) {
        lines.push(`## Review Thoroughness\n`);
        lines.push(`${thoroughness.toFixed(1)} / 5\n`);
      }
      if (ins.strengths.length > 0) {
        lines.push('## Strengths\n');
        ins.strengths.forEach((s) => lines.push(`- ${s}`));
        lines.push('');
      }
      if (ins.keyCollaborators.length > 0) {
        lines.push('## Key Collaborators\n');
        ins.keyCollaborators.forEach((c) => lines.push(`- ${c}`));
        lines.push('');
      }
    }
    lines.push('## Summary\n');
    lines.push(result.summary);
    lines.push('');
    if (result.input?.prs?.length) {
      const dates = result.input.prs.map((p) => p.creationDate).sort();
      lines.push(`---\n*For ${result.input.prs.length} PRs from ${dates[0]?.slice(0, 10)} to ${dates[dates.length - 1]?.slice(0, 10)} · Generated by ${result.model}*`);
    }
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          AI Summary
          {userName && (
            <span className="text-[11px] font-normal text-zinc-400 flex items-center gap-1">
              {userImageUrl && (
                <img src={userImageUrl} alt="" className="w-4 h-4 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
              {userName}
            </span>
          )}
        </h2>
        {result && (
          <button
            onClick={copyAsMarkdown}
            title="Copy as Markdown"
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-ado-blue transition-colors"
          >
            {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </button>
        )}
      </div>

      {!result && !loading && !error && checkedCache && (
        <div>
          <button
            onClick={() => handleGenerate()}
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
          <button onClick={() => handleGenerate(true)} className="text-xs text-ado-blue hover:underline">
            Retry
          </button>
        </div>
      )}

      {result && (
        <div>
          {isStale && result.generatedFor && (
            <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-4 text-xs">
              <span className="text-amber-700 dark:text-amber-400">
                Generated for previous selection ({result.generatedFor.timeRange}, limit {result.generatedFor.fetchLimit})
              </span>
              <button
                onClick={() => handleGenerate(true)}
                disabled={loading}
                className="text-ado-blue hover:underline font-medium ml-2 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Regenerating...
                  </span>
                ) : 'Regenerate for current'}
              </button>
            </div>
          )}
          {ins && (ins.topAreas.length > 0 || ins.strengths.length > 0) && (
            <div className="mb-5 space-y-4">
              {ins.topAreas.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Focus Areas</h3>
                  <div className="space-y-1.5">
                    {ins.topAreas.map((area) => (
                      <div key={area.name} className="flex items-center gap-2 text-xs">
                        <span className="w-52 shrink-0 text-zinc-600 dark:text-zinc-300">{area.name}</span>
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
                {thoroughness > 0 && (
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Thoroughness</h3>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div key={n} className={`w-3 h-3 rounded-sm ${n <= Math.round(thoroughness) ? 'bg-ado-blue' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                      ))}
                    </div>
                    <span className="text-xs text-zinc-400">{thoroughness.toFixed(1)}/5</span>
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
              onClick={() => handleGenerate(true)}
              disabled={loading}
              className="text-xs text-ado-blue hover:underline disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Regenerating...
                </span>
              ) : 'Regenerate'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
