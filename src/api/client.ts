import { useIdentityStore } from "../store/identities";

let cachedOrg = "";
let cachedAuthHeader = "";

export function configureClient(org: string, authHeader?: string) {
  cachedOrg = org;
  cachedAuthHeader = authHeader ?? "";
}

export function buildAvatarUrl(userId: string): string {
  return `/api/ado/avatar?org=${encodeURIComponent(cachedOrg)}&id=${encodeURIComponent(userId)}`;
}

async function serverFetch<T>(path: string, init?: { method?: string; body?: string }): Promise<T> {
  const headers: Record<string, string> = {};
  if (cachedAuthHeader) headers["Authorization"] = cachedAuthHeader;
  if (init?.body) headers["Content-Type"] = "application/json";

  const res = await fetch(path, { headers, method: init?.method, body: init?.body });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const p = new URLSearchParams();
  p.set("org", cachedOrg);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) p.set(k, String(v));
  }
  return p.toString();
}

export async function getConnectionData() {
  return serverFetch<{
    authenticatedUser: {
      id: string;
      providerDisplayName: string;
      properties: Record<string, { $value: string }>;
    };
    authorizedUser: {
      id: string;
      providerDisplayName: string;
      properties: Record<string, { $value: string }>;
    };
  }>(`/api/ado/connection-data?${qs({})}`);
}

export async function getProjects() {
  return serverFetch<{ id: string; name: string; description?: string; state: string }[]>(
    `/api/ado/projects?${qs({})}`,
  );
}

export async function getRepositories(projectName: string) {
  return serverFetch<
    {
      id: string;
      name: string;
      webUrl: string;
      project: { id: string; name: string };
      defaultBranch?: string;
      size: number;
    }[]
  >(`/api/ado/repositories?${qs({ project: projectName })}`);
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
  } = {},
) {
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
    reviewers: {
      id: string;
      displayName: string;
      uniqueName: string;
      imageUrl: string;
      vote: number;
      isRequired?: boolean;
      hasDeclined?: boolean;
    }[];
    labels?: { id: string; name: string; active: boolean }[];
  };

  const prs = await serverFetch<PRResult[]>(
    `/api/ado/pull-requests?${qs({
      project: projectName,
      status: options.status,
      creatorId: options.creatorId,
      reviewerId: options.reviewerId,
      top: options.top,
      skip: options.skip,
      minTime: options.minTime,
      maxTime: options.maxTime,
    })}`,
  );

  collectIdentitiesFromPRs(prs);
  return prs;
}

export async function getPullRequestThreads(
  projectName: string,
  repositoryId: string,
  pullRequestId: number,
) {
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

  return serverFetch<ThreadResult[]>(
    `/api/ado/threads?${qs({ project: projectName, repoId: repositoryId, prId: pullRequestId })}`,
  );
}

export interface PRFileChange {
  path: string;
  changeType: string;
}

export async function getPRFiles(
  projectName: string,
  repositoryId: string,
  pullRequestId: number,
): Promise<PRFileChange[]> {
  return serverFetch<PRFileChange[]>(
    `/api/ado/pr-files?${qs({ project: projectName, repoId: repositoryId, prId: pullRequestId })}`,
  );
}

export async function getPRFilesForMany(
  prs: { projectName: string; repositoryId: string; pullRequestId: number; status: string }[],
  concurrency: number = 5,
): Promise<Map<number, PRFileChange[]>> {
  const result = new Map<number, PRFileChange[]>();
  const queue = [...prs];

  const worker = async () => {
    while (queue.length > 0) {
      const pr = queue.shift();
      if (!pr) break;
      try {
        const files = await getPRFiles(pr.projectName, pr.repositoryId, pr.pullRequestId);
        result.set(pr.pullRequestId, files);
      } catch {
        result.set(pr.pullRequestId, []);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, prs.length) }, () => worker()));
  return result;
}

export async function searchIdentities(query: string) {
  return serverFetch<{ id: string; displayName: string; uniqueName: string; imageUrl: string }[]>(
    `/api/ado/search-identities?${qs({ query })}`,
  );
}

export function buildPrWebUrl(org: string, projectName: string, repoName: string, prId: number) {
  return `https://dev.azure.com/${org}/${encodeURIComponent(projectName)}/_git/${encodeURIComponent(repoName)}/pullrequest/${prId}`;
}

function collectIdentitiesFromPRs(
  prs: {
    createdBy: { id: string; displayName: string; uniqueName: string; imageUrl: string };
    reviewers: { id: string; displayName: string; uniqueName: string; imageUrl: string }[];
  }[],
) {
  const identities = prs.flatMap((pr) => [
    { ...pr.createdBy, imageUrl: buildAvatarUrl(pr.createdBy.id) },
    ...pr.reviewers.map(({ id, displayName, uniqueName }) => ({
      id,
      displayName,
      uniqueName,
      imageUrl: buildAvatarUrl(id),
    })),
  ]);
  useIdentityStore.getState().upsertMany(identities);
}
