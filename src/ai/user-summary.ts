import { getCached, setCache } from '../api/cache';
import { callLLM } from '../api/llm';

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
  insights: {
    topAreas: { name: string; percentage: number }[];
    workStyle: { created: number; reviewed: number };
    reviewThoroughness: number;
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

export interface UserSummaryContext {
  topRepos: string;
  recentPRs: string;
  reviewPatterns: string;
  sampleComments: string;
}

function buildPrompt(context: UserSummaryContext): string {
  return `You are analyzing a software engineer's Azure DevOps activity. Based on the data below, provide TWO things:

1. A concise written summary (3-5 paragraphs) covering what they work on, their contribution patterns, review style, and any specializations.

2. Structured insights as JSON.

## Data

### Top Repositories
${context.topRepos}

### Recent PRs Created
${context.recentPRs}

### Review Patterns
${context.reviewPatterns}

### Sample Review Comments
${context.sampleComments}

## Output Format

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "summary": "Your 3-5 paragraph written summary here...",
  "insights": {
    "topAreas": [{"name": "area name", "percentage": 40}, ...],
    "workStyle": {"created": 60, "reviewed": 40},
    "reviewThoroughness": 3.5,
    "strengths": ["strength 1", "strength 2", "strength 3"],
    "keyCollaborators": ["Name 1", "Name 2"]
  }
}

For topAreas: identify 3-6 technical areas/domains from the PR titles and repos, with percentage of focus (must sum to ~100).
For workStyle: percentage split between creating PRs vs reviewing others' PRs.
For reviewThoroughness: score 1-5 based on comment volume and detail (1=rubber stamp, 5=extremely thorough).
For strengths: 3-5 short phrases describing their engineering strengths.
For keyCollaborators: names of people they frequently work with (from PR authors they review or reviewers on their PRs). Empty array if not enough data.

Write in third person. Be specific and factual.`;
}

function isWorkStyle(v: unknown): v is { created: number; reviewed: number } {
  return typeof v === 'object' && v !== null && 'created' in v && 'reviewed' in v;
}

export async function generateUserSummary(
  context: UserSummaryContext,
  inputPRs: AISummaryInput['prs'] = [],
  cacheId: { userId: string; timeRange: string; fetchLimit: number },
): Promise<AISummaryResult> {
  const cached = await getCachedSummary(cacheId.userId, cacheId.timeRange, cacheId.fetchLimit);
  if (cached?.exact) return cached.result;

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
    insights: {
      topAreas: Array.isArray(ins.topAreas) ? ins.topAreas : [],
      workStyle: isWorkStyle(ins.workStyle) ? ins.workStyle : { created: 50, reviewed: 50 },
      reviewThoroughness: typeof ins.reviewThoroughness === 'number' ? ins.reviewThoroughness : 0,
      strengths: Array.isArray(ins.strengths) ? ins.strengths : [],
      keyCollaborators: Array.isArray(ins.keyCollaborators) ? ins.keyCollaborators : [],
    },
  };

  await saveSummary(cacheId.userId, cacheId.timeRange, cacheId.fetchLimit, result);
  return result;
}
