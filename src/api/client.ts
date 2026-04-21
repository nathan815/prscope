import type { PagedResponse } from '../types';
import type { AuthMode } from '../auth/useAuth';
import { getCached, setCache } from './cache';

let cachedOrg = '';
let cachedMode: AuthMode = 'oauth';
let cachedTokenProvider: (() => Promise<string>) | null = null;

export function configureClient(
  org: string,
  mode: AuthMode,
  tokenProvider: () => Promise<string>
) {
  cachedOrg = org;
  cachedMode = mode;
  cachedTokenProvider = tokenProvider;
}

async function adoFetch<T>(path: string, base: 'ado' | 'vssps' = 'ado', init?: { method?: string; body?: string }): Promise<T> {
  if (!cachedOrg || !cachedTokenProvider) {
    throw new Error('ADO client not configured');
  }

  const token = await cachedTokenProvider();

  let url: string;
  const headers: Record<string, string> = {};

  if (cachedMode === 'oauth' || cachedMode === 'az-cli') {
    const baseUrl = base === 'ado' ? 'https://dev.azure.com' : 'https://vssps.dev.azure.com';
    url = `${baseUrl}/${cachedOrg}${path}`;
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    url = `/api/${base}/${cachedOrg}${path}`;
    headers['x-ado-pat'] = token;
  }

  if (init?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { headers, method: init?.method, body: init?.body });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ADO API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function getConnectionData() {
  return adoFetch<{
    authenticatedUser: { id: string; providerDisplayName: string; properties: Record<string, { $value: string }> };
    authorizedUser: { id: string; providerDisplayName: string; properties: Record<string, { $value: string }> };
  }>('/_apis/connectionData');
}

export async function getProjects() {
  const res = await adoFetch<PagedResponse<{ id: string; name: string; description?: string; state: string }>>('/_apis/projects?api-version=7.1&$top=500');
  return res.value.filter((p) => p.state === 'wellFormed').sort((a, b) => a.name.localeCompare(b.name));
}

export async function getRepositories(projectName: string) {
  const res = await adoFetch<PagedResponse<{
    id: string; name: string; webUrl: string; project: { id: string; name: string }; defaultBranch?: string; size: number;
  }>>(`/${encodeURIComponent(projectName)}/_apis/git/repositories?api-version=7.1`);
  return res.value.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getPullRequests(
  projectName: string,
  repositoryId: string,
  options: {
    status?: string;
    creatorId?: string;
    reviewerId?: string;
    top?: number;
    skip?: number;
  } = {}
) {
  const params = new URLSearchParams({ 'api-version': '7.1' });
  if (options.status) params.set('searchCriteria.status', options.status);
  if (options.creatorId) params.set('searchCriteria.creatorId', options.creatorId);
  if (options.reviewerId) params.set('searchCriteria.reviewerId', options.reviewerId);
  params.set('$top', String(options.top ?? 50));
  if (options.skip) params.set('$skip', String(options.skip));

  const res = await adoFetch<PagedResponse<{
    pullRequestId: number;
    title: string;
    description?: string;
    status: string;
    createdBy: { id: string; displayName: string; uniqueName: string; imageUrl: string };
    creationDate: string;
    closedDate?: string;
    isDraft: boolean;
    mergeStatus?: string;
    repository: { id: string; name: string; webUrl: string; project: { id: string; name: string } };
    sourceRefName: string;
    targetRefName: string;
    reviewers: { id: string; displayName: string; uniqueName: string; imageUrl: string; vote: number; isRequired?: boolean; hasDeclined?: boolean }[];
    labels?: { id: string; name: string; active: boolean }[];
  }>>(
    `/${encodeURIComponent(projectName)}/_apis/git/repositories/${repositoryId}/pullrequests?${params}`
  );

  return res.value;
}

export async function getProjectPullRequests(
  projectName: string,
  options: {
    status?: string;
    creatorId?: string;
    reviewerId?: string;
    top?: number;
    skip?: number;
    minTime?: string;
    maxTime?: string;
    skipCache?: boolean;
  } = {}
) {
  const CACHE_TTL = 5 * 60 * 1000;
  const params = new URLSearchParams({ 'api-version': '7.1' });
  if (options.status) params.set('searchCriteria.status', options.status);
  if (options.creatorId) params.set('searchCriteria.creatorId', options.creatorId);
  if (options.reviewerId) params.set('searchCriteria.reviewerId', options.reviewerId);
  if (options.minTime) params.set('searchCriteria.minTime', options.minTime);
  if (options.maxTime) params.set('searchCriteria.maxTime', options.maxTime);
  params.set('$top', String(options.top ?? 100));
  if (options.skip) params.set('$skip', String(options.skip));

  const cacheKey = `prs:${cachedOrg}:${projectName}:${params}`;
  type PRResult = {
    pullRequestId: number;
    title: string;
    description?: string;
    status: string;
    createdBy: { id: string; displayName: string; uniqueName: string; imageUrl: string };
    creationDate: string;
    closedDate?: string;
    isDraft: boolean;
    mergeStatus?: string;
    repository: { id: string; name: string; webUrl: string; project: { id: string; name: string } };
    sourceRefName: string;
    targetRefName: string;
    reviewers: { id: string; displayName: string; uniqueName: string; imageUrl: string; vote: number; isRequired?: boolean; hasDeclined?: boolean }[];
    labels?: { id: string; name: string; active: boolean }[];
  };

  if (!options.skipCache) {
    const cached = await getCached<PRResult[]>(cacheKey, CACHE_TTL);
    if (cached) return cached;
  }

  const res = await adoFetch<PagedResponse<PRResult>>(
    `/${encodeURIComponent(projectName)}/_apis/git/pullrequests?${params}`
  );

  await setCache(cacheKey, res.value);
  return res.value;
}

export async function getPullRequestThreads(
  projectName: string,
  repositoryId: string,
  pullRequestId: number
) {
  const CACHE_TTL = 30 * 60 * 1000;
  const cacheKey = `threads:${cachedOrg}:${projectName}:${repositoryId}:${pullRequestId}`;

  type ThreadResult = {
    id: number;
    publishedDate: string;
    lastUpdatedDate: string;
    status?: string;
    comments: {
      id: number;
      content: string;
      publishedDate: string;
      author: { id: string; displayName: string; uniqueName: string; imageUrl: string };
      commentType: string;
    }[];
    threadContext?: { filePath: string };
    properties?: Record<string, { $type?: string; $value: string }>;
  };

  const cached = await getCached<ThreadResult[]>(cacheKey, CACHE_TTL);
  if (cached) return cached;

  const res = await adoFetch<PagedResponse<ThreadResult>>(
    `/${encodeURIComponent(projectName)}/_apis/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/threads?api-version=7.1`
  );

  await setCache(cacheKey, res.value);
  return res.value;
}

export async function searchIdentities(query: string) {
  const res = await adoFetch<{
    results: {
      identities: {
        entityId: string;
        originId: string;
        localId: string | null;
        displayName: string | null;
        samAccountName: string | null;
        mail: string | null;
        signInAddress: string | null;
        subjectDescriptor: string | null;
      }[];
    }[];
  }>(
    `/_apis/IdentityPicker/Identities?api-version=7.1-preview.1`,
    'ado',
    {
      method: 'POST',
      body: JSON.stringify({
        query,
        identityTypes: ['user'],
        operationScopes: ['ims', 'source'],
        properties: ['DisplayName', 'Mail', 'SignInAddress', 'SamAccountName', 'SubjectDescriptor'],
        options: { MinResults: 5, MaxResults: 20 },
      }),
    }
  );

  return (res.results?.[0]?.identities ?? [])
    .filter((i) => i.displayName)
    .map((i) => ({
      id: i.localId ?? i.originId,
      displayName: i.displayName ?? '',
      uniqueName: i.signInAddress ?? i.mail ?? i.samAccountName ?? '',
      imageUrl: i.subjectDescriptor
        ? buildAvatarUrl(i.subjectDescriptor)
        : '',
    }));
}

function buildAvatarUrl(subjectDescriptor: string): string {
  if (cachedMode === 'oauth' || cachedMode === 'az-cli') {
    return `https://dev.azure.com/${cachedOrg}/_apis/GraphProfile/MemberAvatars/${subjectDescriptor}`;
  }
  return `/api/ado/${cachedOrg}/_apis/GraphProfile/MemberAvatars/${subjectDescriptor}`;
}

export function buildPrWebUrl(org: string, projectName: string, repoName: string, prId: number) {
  return `https://dev.azure.com/${org}/${encodeURIComponent(projectName)}/_git/${encodeURIComponent(repoName)}/pullrequest/${prId}`;
}
