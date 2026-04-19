import type { PagedResponse } from '../types';
import type { AuthMode } from '../auth/useAuth';

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

async function adoFetch<T>(path: string, base: 'ado' | 'vssps' = 'ado'): Promise<T> {
  if (!cachedOrg || !cachedTokenProvider) {
    throw new Error('ADO client not configured');
  }

  const token = await cachedTokenProvider();

  let url: string;
  let headers: Record<string, string>;

  if (cachedMode === 'oauth' || cachedMode === 'az-cli') {
    const baseUrl = base === 'ado' ? 'https://dev.azure.com' : 'https://vssps.dev.azure.com';
    url = `${baseUrl}/${cachedOrg}${path}`;
    headers = { 'Authorization': `Bearer ${token}` };
  } else {
    url = `/api/${base}/${cachedOrg}${path}`;
    headers = { 'x-ado-pat': token };
  }

  const res = await fetch(url, { headers });

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

export async function getPullRequestThreads(
  projectName: string,
  repositoryId: string,
  pullRequestId: number
) {
  const res = await adoFetch<PagedResponse<{
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
  }>>(
    `/${encodeURIComponent(projectName)}/_apis/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/threads?api-version=7.1`
  );
  return res.value;
}

export async function searchIdentities(query: string) {
  const res = await adoFetch<PagedResponse<{
    id: string;
    displayName: string;
    uniqueName: string;
    imageUrl: string;
  }>>(`/_apis/identities?searchFilter=General&filterValue=${encodeURIComponent(query)}&queryMembership=None&api-version=7.1`, 'vssps');
  return res.value;
}

export function buildPrWebUrl(org: string, projectName: string, repoName: string, prId: number) {
  return `https://dev.azure.com/${org}/${encodeURIComponent(projectName)}/_git/${encodeURIComponent(repoName)}/pullrequest/${prId}`;
}
