import { getCached, setCache } from './cache';

const FEED_CACHE_PREFIX = 'feed:';

export interface CachedFeedItem {
  id: string;
  type: string;
  user: { id: string; displayName: string; uniqueName: string; imageUrl: string };
  pullRequest: {
    pullRequestId: number;
    title: string;
    status: string;
    isDraft: boolean;
    createdBy: { id: string; displayName: string; uniqueName: string; imageUrl: string };
    creationDate: string;
    closedDate?: string;
    mergeStatus?: string;
    repository: { id: string; name: string; webUrl: string; project: { id: string; name: string } };
    sourceRefName: string;
    targetRefName: string;
    reviewers: { id: string; displayName: string; uniqueName: string; imageUrl: string; vote: number; isRequired?: boolean }[];
  };
  timestamp: string;
  timestampLabel: string;
  isSelf: boolean;
}

function buildCacheKey(userId: string, followIds: string[], projectNames: string[]): string {
  return `${FEED_CACHE_PREFIX}${userId}:${followIds.sort().join(',')}:${projectNames.sort().join(',')}`;
}

export async function getFeedCache(userId: string, followIds: string[], projectNames: string[]): Promise<CachedFeedItem[] | null> {
  const key = buildCacheKey(userId, followIds, projectNames);
  return getCached<CachedFeedItem[]>(key, 7 * 24 * 60 * 60 * 1000);
}

export async function setFeedCache(userId: string, followIds: string[], projectNames: string[], items: CachedFeedItem[]): Promise<void> {
  const key = buildCacheKey(userId, followIds, projectNames);
  await setCache(key, items);
}
