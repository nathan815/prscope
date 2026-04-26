import type { IncomingMessage, ServerResponse } from "http";
import { adoFetch, resolveToken } from "./ado-fetch";
import { upsertPullRequests, upsertPRFiles, queryDb, getSchema } from "./db";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Uint8Array[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Uint8Array));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
  });
}

function parseQuery(url: string): URLSearchParams {
  const idx = url.indexOf("?");
  return idx >= 0 ? new URLSearchParams(url.slice(idx + 1)) : new URLSearchParams();
}

function sendJson(res: ServerResponse, data: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function proxyAvatarUrl(org: string, userId: string): string {
  return `/api/ado/avatar?org=${encodeURIComponent(org)}&id=${encodeURIComponent(userId)}`;
}

function rewritePRAvatars(
  org: string,
  prs: {
    createdBy: { id: string; imageUrl: string };
    reviewers: { id: string; imageUrl: string }[];
  }[],
) {
  for (const pr of prs) {
    pr.createdBy.imageUrl = proxyAvatarUrl(org, pr.createdBy.id);
    for (const r of pr.reviewers) {
      r.imageUrl = proxyAvatarUrl(org, r.id);
    }
  }
}

function sendError(res: ServerResponse, message: string, status = 500) {
  sendJson(res, { error: message }, status);
}

export async function handleConnectionData(req: IncomingMessage, res: ServerResponse) {
  try {
    const q = parseQuery(req.url ?? "");
    const org = q.get("org");
    if (!org) return sendError(res, "org is required", 400);

    const token = resolveToken(req.headers.authorization);
    const data = await adoFetch(token, org, "/_apis/connectionData");
    sendJson(res, data);
  } catch (err) {
    sendError(res, String(err));
  }
}

export async function handleProjects(req: IncomingMessage, res: ServerResponse) {
  try {
    const q = parseQuery(req.url ?? "");
    const org = q.get("org");
    if (!org) return sendError(res, "org is required", 400);

    const token = resolveToken(req.headers.authorization);
    const data = await adoFetch<{ value: { id: string; name: string; state: string }[] }>(
      token,
      org,
      "/_apis/projects?api-version=7.1&$top=500",
    );
    const projects = data.value
      .filter((p) => p.state === "wellFormed")
      .sort((a, b) => a.name.localeCompare(b.name));
    sendJson(res, projects);
  } catch (err) {
    sendError(res, String(err));
  }
}

export async function handleRepositories(req: IncomingMessage, res: ServerResponse) {
  try {
    const q = parseQuery(req.url ?? "");
    const org = q.get("org");
    const project = q.get("project");
    if (!org || !project) return sendError(res, "org and project are required", 400);

    const token = resolveToken(req.headers.authorization);
    const data = await adoFetch<{
      value: {
        id: string;
        name: string;
        webUrl: string;
        project: { id: string; name: string };
        defaultBranch?: string;
        size: number;
      }[];
    }>(token, org, `/${encodeURIComponent(project)}/_apis/git/repositories?api-version=7.1`);
    sendJson(
      res,
      data.value.sort((a, b) => a.name.localeCompare(b.name)),
    );
  } catch (err) {
    sendError(res, String(err));
  }
}

export async function handlePullRequests(req: IncomingMessage, res: ServerResponse) {
  try {
    const q = parseQuery(req.url ?? "");
    const org = q.get("org");
    const project = q.get("project");
    if (!org || !project) return sendError(res, "org and project are required", 400);

    const params = new URLSearchParams({ "api-version": "7.1" });
    if (q.get("status")) params.set("searchCriteria.status", q.get("status")!);
    if (q.get("creatorId")) params.set("searchCriteria.creatorId", q.get("creatorId")!);
    if (q.get("reviewerId")) params.set("searchCriteria.reviewerId", q.get("reviewerId")!);
    if (q.get("minTime")) params.set("searchCriteria.minTime", q.get("minTime")!);
    if (q.get("maxTime")) params.set("searchCriteria.maxTime", q.get("maxTime")!);
    params.set("$top", q.get("top") ?? "100");
    if (q.get("skip")) params.set("$skip", q.get("skip")!);

    const token = resolveToken(req.headers.authorization);
    const data = await adoFetch<{ value: unknown[] }>(
      token,
      org,
      `/${encodeURIComponent(project)}/_apis/git/pullrequests?${params}`,
    );

    rewritePRAvatars(org, data.value as Parameters<typeof rewritePRAvatars>[1]);
    sendJson(res, data.value);
    try {
      upsertPullRequests(org, data.value as Parameters<typeof upsertPullRequests>[1]);
    } catch (dbErr) {
      console.error("[ado-api] DB write failed:", dbErr);
    }
  } catch (err) {
    sendError(res, String(err));
  }
}

export async function handleThreads(req: IncomingMessage, res: ServerResponse) {
  try {
    const q = parseQuery(req.url ?? "");
    const org = q.get("org");
    const project = q.get("project");
    const repoId = q.get("repoId");
    const prId = q.get("prId");
    if (!org || !project || !repoId || !prId)
      return sendError(res, "org, project, repoId, prId are required", 400);

    const token = resolveToken(req.headers.authorization);
    const data = await adoFetch<{ value: unknown[] }>(
      token,
      org,
      `/${encodeURIComponent(project)}/_apis/git/repositories/${repoId}/pullrequests/${prId}/threads?api-version=7.1`,
    );
    // Rewrite comment author avatars
    for (const thread of data.value as {
      comments?: { author?: { id: string; imageUrl: string } }[];
    }[]) {
      for (const comment of thread.comments ?? []) {
        if (comment.author?.id) {
          comment.author.imageUrl = proxyAvatarUrl(org, comment.author.id);
        }
      }
    }
    sendJson(res, data.value);
  } catch (err) {
    sendError(res, String(err));
  }
}

export async function handlePRFiles(req: IncomingMessage, res: ServerResponse) {
  try {
    const q = parseQuery(req.url ?? "");
    const org = q.get("org");
    const project = q.get("project");
    const repoId = q.get("repoId");
    const prId = q.get("prId");
    if (!org || !project || !repoId || !prId)
      return sendError(res, "org, project, repoId, prId are required", 400);

    const token = resolveToken(req.headers.authorization);

    const iterData = await adoFetch<{ count: number }>(
      token,
      org,
      `/${encodeURIComponent(project)}/_apis/git/repositories/${repoId}/pullrequests/${prId}/iterations?api-version=7.1`,
    );
    if (iterData.count === 0) return sendJson(res, []);

    const changesData = await adoFetch<{
      changeEntries: { changeType: string; item: { path: string } | null }[];
    }>(
      token,
      org,
      `/${encodeURIComponent(project)}/_apis/git/repositories/${repoId}/pullrequests/${prId}/iterations/${iterData.count}/changes?api-version=7.1`,
    );

    const files = (changesData.changeEntries ?? [])
      .filter((e) => e.item?.path)
      .map((e) => ({ path: e.item!.path, changeType: e.changeType }));

    sendJson(res, files);

    try {
      upsertPRFiles(Number(prId), files);
    } catch (dbErr) {
      console.error("[ado-api] DB write failed:", dbErr);
    }
  } catch (err) {
    sendError(res, String(err));
  }
}

export async function handleSearchIdentities(req: IncomingMessage, res: ServerResponse) {
  try {
    const q = parseQuery(req.url ?? "");
    const org = q.get("org");
    const query = q.get("query");
    if (!org || !query) return sendError(res, "org and query are required", 400);

    const token = resolveToken(req.headers.authorization);
    const data = await adoFetch<{
      results: {
        identities: {
          originId: string;
          localId: string | null;
          displayName: string | null;
          samAccountName: string | null;
          mail: string | null;
          signInAddress: string | null;
          subjectDescriptor: string | null;
        }[];
      }[];
    }>(token, org, "/_apis/IdentityPicker/Identities?api-version=7.1-preview.1", "ado", {
      method: "POST",
      body: JSON.stringify({
        query,
        identityTypes: ["user"],
        operationScopes: ["ims", "source"],
        properties: ["DisplayName", "Mail", "SignInAddress", "SamAccountName", "SubjectDescriptor"],
        options: { MinResults: 5, MaxResults: 20 },
      }),
    });

    const identities = (data.results?.[0]?.identities ?? [])
      .filter((i) => i.displayName)
      .map((i) => ({
        id: i.localId ?? i.originId,
        displayName: i.displayName ?? "",
        uniqueName: i.signInAddress ?? i.mail ?? i.samAccountName ?? "",
        imageUrl: i.localId
          ? `/api/ado/avatar?org=${encodeURIComponent(org)}&id=${encodeURIComponent(i.localId)}`
          : "",
      }));

    sendJson(res, identities);
  } catch (err) {
    sendError(res, String(err));
  }
}

export async function handleAvatar(req: IncomingMessage, res: ServerResponse) {
  try {
    const q = parseQuery(req.url ?? "");
    const org = q.get("org");
    const id = q.get("id");
    if (!org || !id) return sendError(res, "org and id are required", 400);

    const token = resolveToken(req.headers.authorization);
    const imgRes = await fetch(`https://dev.azure.com/${org}/_api/_common/identityImage?id=${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "follow",
    });

    if (!imgRes.ok) {
      res.statusCode = imgRes.status;
      res.end();
      return;
    }

    const contentType = imgRes.headers.get("content-type") ?? "image/png";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    res.end(buffer);
  } catch {
    res.statusCode = 404;
    res.end();
  }
}

export async function handleDbQuery(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = JSON.parse(await readBody(req)) as { sql: string; params?: unknown[] };
    if (!body.sql) return sendError(res, "sql is required", 400);

    const results = queryDb(body.sql, body.params ?? []);
    sendJson(res, { results, count: results.length });
  } catch (err) {
    sendError(res, String(err));
  }
}

export function handleDbSchema(_req: IncomingMessage, res: ServerResponse) {
  try {
    sendJson(res, { schema: getSchema() });
  } catch (err) {
    sendError(res, String(err));
  }
}
