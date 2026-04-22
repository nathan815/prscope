import { getCached, setCache } from '../api/cache';
import { callLLM } from '../api/llm';
import { computeReviewThoroughness } from './review-thoroughness';

export interface AISummaryInput {
  prs: { id: number; title: string; repo: string; creationDate: string; status: string }[];
  prompt: string;
}

export interface AISummaryResult {
  model: string;
  generatedAt: string;
  summary: string;
  input: AISummaryInput;
  generatedFor: { timeRange: string; fetchLimit: number };
  reviewThoroughness: number;
  insights: {
    topAreas: { name: string; percentage: number }[];
    workStyle: { created: number; reviewed: number };
    strengths: string[];
    keyCollaborators: string[];
  };
}

const CACHE_TTL = 365 * 24 * 60 * 60 * 1000;
const ENTRY_MAX_AGE = 2 * 24 * 60 * 60 * 1000;

function userCacheKey(userId: string): string {
  return `ai-summary-history:${userId}`;
}

export interface CachedSummaryMatch {
  result: AISummaryResult;
  exact: boolean;
}

export async function getCachedSummary(userId: string, timeRange: string, fetchLimit: number): Promise<CachedSummaryMatch | null> {
  const entries = await getCached<AISummaryResult[]>(userCacheKey(userId), CACHE_TTL);
  if (!entries || entries.length === 0) return null;

  const exact = entries.find(
    (e) => e.generatedFor?.timeRange === timeRange && e.generatedFor?.fetchLimit === fetchLimit,
  );
  if (exact) return { result: exact, exact: true };

  return { result: entries[0]!, exact: false };
}

async function saveSummary(userId: string, timeRange: string, fetchLimit: number, result: AISummaryResult): Promise<void> {
  const entries = (await getCached<AISummaryResult[]>(userCacheKey(userId), CACHE_TTL)) ?? [];
  const now = Date.now();

  const cleaned = entries.filter((e) => {
    const isCurrentParams = e.generatedFor?.timeRange === timeRange && e.generatedFor?.fetchLimit === fetchLimit;
    if (isCurrentParams) return false;
    const age = now - new Date(e.generatedAt).getTime();
    return age < ENTRY_MAX_AGE;
  });

  const updated = [result, ...cleaned];
  await setCache(userCacheKey(userId), updated);
}

export interface ReviewImpactData {
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

export interface PRData {
  pullRequestId: number;
  title: string;
  status: string;
  sourceRefName: string;
  targetRefName: string;
  creationDate: string;
  repository: { name: string };
  reviewers: { displayName: string; vote: number }[];
}

export interface UserSummaryContext {
  userName: string;
  topRepos: { name: string; project: string; created: number; reviewed: number }[];
  createdPRs: PRData[];
  reviewedPRs: PRData[];
  reviewImpact: ReviewImpactData | undefined;
}

function branchName(ref: string) {
  return ref.replace("refs/heads/", "");
}

function voteLabel(v: number) {
  return v >= 10 ? "approved" : v >= 5 ? "approved w/ suggestions" : v <= -10 ? "rejected" : v <= -5 ? "waiting" : null;
}

function formatPR(pr: PRData): string {
  const votedReviewers = pr.reviewers
    .filter((r) => r.vote !== 0)
    .map((r) => `${r.displayName} (${voteLabel(r.vote)})`)
    .join(", ");
  const reviewerPart = votedReviewers ? ` | reviewers: ${votedReviewers}` : "";
  return `- [${pr.repository.name}] ${pr.title} (${pr.status}) | ${branchName(pr.sourceRefName)} → ${branchName(pr.targetRefName)}${reviewerPart}`;
}

function buildPrompt(context: UserSummaryContext): string {
  const topReposText = context.topRepos
    .slice(0, 10)
    .map((r) => `${r.name} (${r.project}): ${r.created} PRs created, ${r.reviewed} reviewed`)
    .join("\n");

  const createdText = context.createdPRs.map(formatPR).join("\n");
  const reviewedText = context.reviewedPRs.map(formatPR).join("\n");
  const allPRsText = `Created PRs (${context.createdPRs.length}):\n${createdText}\n\nReviewed PRs (${context.reviewedPRs.length}):\n${reviewedText}`;

  let reviewPatternsText = "No review data available";
  if (context.reviewImpact) {
    const ri = context.reviewImpact;
    reviewPatternsText = `Across recent reviewed PRs:
- ${ri.approved ?? 0} approved, ${ri.approvedWithSuggestions ?? 0} approved w/ suggestions, ${ri.waitingForAuthor ?? 0} waiting for author, ${ri.rejected ?? 0} rejected
- Of approvals: ${ri.approvalsWithComments ?? 0} had review comments before approving, ${ri.approvalsWithoutComments ?? 0} approved without comments
- ${ri.totalComments} total comments, avg ${ri.avgCommentsPerPr.toFixed(1)} per PR`;
  }

  const comments = context.reviewImpact?.commentTexts ?? [];
  const sampleCommentsText = comments
    .slice(0, 50)
    .map((c, i) => {
      const path = c.filePath ? `[${c.filePath}] ` : "";
      return `${i + 1}. ${path}${c.content}`;
    })
    .join("\n");

  return `You are analyzing a software engineer's Azure DevOps activity. Based on the data below, provide TWO things:

1. A concise written summary (3-5 paragraphs) covering what they work on, their contribution patterns (compare created vs reviewed counts accurately — if reviewed > created, they skew toward reviewing, not authoring), review style, and any specializations.

2. Structured insights as JSON.

## Data

### Engineer
${context.userName}

### Top Repositories
${topReposText || "No repo data"}

### PRs
${allPRsText || "No PR data"}

### Review Patterns
${reviewPatternsText}

### Sample Review Comments
${sampleCommentsText || "No comments available"}

## Output Format

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "summary": "Your 3-5 paragraph written summary here...",
  "insights": {
    "topAreas": [{"name": "area name", "percentage": 40}, ...],
    "workStyle": {"created": 60, "reviewed": 40},
    "strengths": ["strength 1", "strength 2", "strength 3"],
    "keyCollaborators": ["Name 1", "Name 2"]
  }
}

For topAreas: identify 3-6 technical areas/domains from the PR titles and repos, with percentage of focus (must sum to ~100).
For workStyle: percentage split between creating PRs vs reviewing others' PRs.
For strengths: 3-5 short phrases describing their engineering strengths.
For keyCollaborators: names of people they frequently work with (from PR authors they review or reviewers on their PRs). Empty array if not enough data.

Write in third person using gender-neutral pronouns (they/their). Be specific and factual. Describe what they work on and their patterns — do not editorialize or use subjective adjectives (e.g. avoid "prolific", "talented", "impressive", "excellent"). When describing review style, back up characterizations with evidence from the data (e.g. "their reviews average N comments and frequently address error handling, test coverage, and architecture" rather than just "thorough reviewer"). Replace narrative verbs like "driven" or "led" with specific actions: "authored", "reviewed", "modified". Let the data speak for itself.`;
}

function isWorkStyle(v: unknown): v is { created: number; reviewed: number } {
  return typeof v === 'object' && v !== null && 'created' in v && 'reviewed' in v;
}

export async function generateUserSummary(
  context: UserSummaryContext,
  inputPRs: AISummaryInput['prs'] = [],
  cacheId: { userId: string; timeRange: string; fetchLimit: number },
  skipCache = false,
): Promise<AISummaryResult> {
  if (!skipCache) {
    const cached = await getCachedSummary(cacheId.userId, cacheId.timeRange, cacheId.fetchLimit);
    if (cached?.exact) return cached.result;
  }

  const prompt = buildPrompt(context);
  const inputData: AISummaryInput = { prs: inputPRs, prompt };

  const { content: rawContent, model } = await callLLM([{ role: 'user', content: prompt }]);
  const cleaned = rawContent.replace(/^```json?\s*|\s*```$/g, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`LLM returned invalid JSON. Raw response:\n${rawContent.slice(0, 500)}`);
  }

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.summary !== 'string' || !obj.summary) {
    throw new Error(`LLM response missing "summary" field. Parsed:\n${JSON.stringify(obj).slice(0, 500)}`);
  }

  const ins = (obj.insights ?? {}) as Record<string, unknown>;

  const result: AISummaryResult = {
    model,
    generatedAt: new Date().toISOString(),
    summary: obj.summary,
    input: inputData,
    generatedFor: { timeRange: cacheId.timeRange, fetchLimit: cacheId.fetchLimit },
    reviewThoroughness: context.reviewImpact ? computeReviewThoroughness(context.reviewImpact) : 0,
    insights: {
      topAreas: Array.isArray(ins.topAreas) ? ins.topAreas : [],
      workStyle: isWorkStyle(ins.workStyle) ? ins.workStyle : { created: 50, reviewed: 50 },
      strengths: Array.isArray(ins.strengths) ? ins.strengths : [],
      keyCollaborators: Array.isArray(ins.keyCollaborators) ? ins.keyCollaborators : [],
    },
  };

  await saveSummary(cacheId.userId, cacheId.timeRange, cacheId.fetchLimit, result);
  return result;
}
