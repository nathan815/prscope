export interface AdoProject {
  id: string;
  name: string;
  description?: string;
  url: string;
  state: string;
}

export interface AdoRepository {
  id: string;
  name: string;
  url: string;
  webUrl: string;
  project: {
    id: string;
    name: string;
  };
  defaultBranch?: string;
  size: number;
}

export interface AdoIdentityRef {
  id: string;
  displayName: string;
  uniqueName: string;
  imageUrl: string;
  url: string;
}

export interface AdoReviewer extends AdoIdentityRef {
  vote: number;
  isRequired?: boolean;
  hasDeclined?: boolean;
}

export type PullRequestStatus = "active" | "completed" | "abandoned" | "all";

export interface AdoPullRequest {
  pullRequestId: number;
  title: string;
  description?: string;
  status: PullRequestStatus;
  createdBy: AdoIdentityRef;
  creationDate: string;
  closedDate?: string;
  mergeStatus?: string;
  isDraft: boolean;
  repository: AdoRepository;
  sourceRefName: string;
  targetRefName: string;
  reviewers: AdoReviewer[];
  url: string;
  mergeId?: string;
  labels?: { id: string; name: string; active: boolean }[];
  completionOptions?: {
    mergeStrategy: string;
    deleteSourceBranch: boolean;
  };
}

export interface AdoThread {
  id: number;
  publishedDate: string;
  lastUpdatedDate: string;
  comments: AdoComment[];
  status?: string;
  properties?: Record<string, { $value: string }>;
  isDeleted?: boolean;
  threadContext?: {
    filePath: string;
  };
}

export interface AdoComment {
  id: number;
  parentCommentId: number;
  content: string;
  publishedDate: string;
  lastUpdatedDate: string;
  author: AdoIdentityRef;
  commentType: string;
}

export interface AdoGraphUser {
  subjectKind: string;
  displayName: string;
  url: string;
  descriptor: string;
  principalName: string;
  origin: string;
  originId: string;
  mailAddress?: string;
}

export interface AdoConnectionData {
  authenticatedUser: {
    id: string;
    descriptor: string;
    subjectDescriptor: string;
    providerDisplayName: string;
    isActive: boolean;
    properties: Record<string, { $type: string; $value: string }>;
  };
  authorizedUser: {
    id: string;
    descriptor: string;
    subjectDescriptor: string;
    providerDisplayName: string;
    isActive: boolean;
    properties: Record<string, { $type: string; $value: string }>;
  };
}

export interface FavoriteRepo {
  repoId: string;
  repoName: string;
  projectId: string;
  projectName: string;
}

export interface FollowedUser {
  id: string;
  displayName: string;
  uniqueName: string;
  imageUrl: string;
}

export interface ActivityFeedItem {
  id: string;
  type: "pr_created" | "pr_completed" | "pr_reviewed" | "pr_commented";
  user: AdoIdentityRef;
  pullRequest: AdoPullRequest;
  timestamp: string;
  details?: string;
}

export interface PagedResponse<T> {
  value: T[];
  count: number;
}
