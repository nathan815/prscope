import { DatabaseSync } from "node:sqlite";
import { join } from "path";

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;

  const dbPath = join(process.cwd(), ".prscope.db");
  console.log("[db] Opening SQLite database at", dbPath);
  db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS pull_requests (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      created_by_id TEXT NOT NULL,
      created_by_name TEXT,
      created_by_unique_name TEXT,
      created_by_image_url TEXT,
      repo_id TEXT NOT NULL,
      repo_name TEXT NOT NULL,
      project_name TEXT NOT NULL,
      source_branch TEXT,
      target_branch TEXT,
      creation_date TEXT NOT NULL,
      closed_date TEXT,
      is_draft INTEGER DEFAULT 0,
      merge_status TEXT,
      org TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_pr_created_by ON pull_requests(created_by_id);
    CREATE INDEX IF NOT EXISTS idx_pr_repo ON pull_requests(repo_id);
    CREATE INDEX IF NOT EXISTS idx_pr_project ON pull_requests(project_name);
    CREATE INDEX IF NOT EXISTS idx_pr_status ON pull_requests(status);
    CREATE INDEX IF NOT EXISTS idx_pr_org ON pull_requests(org);

    CREATE TABLE IF NOT EXISTS pr_reviewers (
      pr_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      unique_name TEXT,
      image_url TEXT,
      vote INTEGER DEFAULT 0,
      is_required INTEGER DEFAULT 0,
      PRIMARY KEY (pr_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_reviewer_user ON pr_reviewers(user_id);

    CREATE TABLE IF NOT EXISTS pr_files (
      pr_id INTEGER NOT NULL,
      path TEXT NOT NULL,
      change_type TEXT NOT NULL,
      PRIMARY KEY (pr_id, path)
    );

    CREATE INDEX IF NOT EXISTS idx_files_path ON pr_files(path);

    CREATE TABLE IF NOT EXISTS identities (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      unique_name TEXT,
      image_url TEXT,
      last_seen TEXT DEFAULT (datetime('now'))
    );
  `);

  console.log("[db] Schema initialized");
  return db;
}

export function upsertPullRequests(
  org: string,
  prs: {
    pullRequestId: number;
    title: string;
    description?: string;
    status: string;
    createdBy: { id: string; displayName: string; uniqueName: string; imageUrl: string };
    repository: { id: string; name: string; project: { name: string } };
    sourceRefName: string;
    targetRefName: string;
    creationDate: string;
    closedDate?: string;
    isDraft: boolean;
    mergeStatus?: string;
    reviewers: {
      id: string;
      displayName: string;
      uniqueName: string;
      imageUrl: string;
      vote: number;
      isRequired?: boolean;
    }[];
  }[],
) {
  const db = getDb();

  const upsertPR = db.prepare(`
    INSERT OR REPLACE INTO pull_requests
      (id, title, description, status, created_by_id, created_by_name, created_by_unique_name,
       created_by_image_url, repo_id, repo_name, project_name, source_branch, target_branch,
       creation_date, closed_date, is_draft, merge_status, org, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const upsertReviewer = db.prepare(`
    INSERT OR REPLACE INTO pr_reviewers (pr_id, user_id, user_name, unique_name, image_url, vote, is_required)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const upsertIdentity = db.prepare(`
    INSERT OR REPLACE INTO identities (id, display_name, unique_name, image_url, last_seen)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);

  db.exec("BEGIN TRANSACTION");
  try {
    for (const pr of prs) {
      upsertPR.run(
        pr.pullRequestId,
        pr.title,
        pr.description ?? null,
        pr.status,
        pr.createdBy.id,
        pr.createdBy.displayName,
        pr.createdBy.uniqueName,
        pr.createdBy.imageUrl,
        pr.repository.id,
        pr.repository.name,
        pr.repository.project.name,
        pr.sourceRefName,
        pr.targetRefName,
        pr.creationDate,
        pr.closedDate ?? null,
        pr.isDraft ? 1 : 0,
        pr.mergeStatus ?? null,
        org,
      );

      upsertIdentity.run(
        pr.createdBy.id,
        pr.createdBy.displayName,
        pr.createdBy.uniqueName,
        pr.createdBy.imageUrl,
      );

      for (const r of pr.reviewers) {
        upsertReviewer.run(
          pr.pullRequestId,
          r.id,
          r.displayName,
          r.uniqueName,
          r.imageUrl,
          r.vote,
          r.isRequired ? 1 : 0,
        );
        upsertIdentity.run(r.id, r.displayName, r.uniqueName, r.imageUrl);
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function upsertPRFiles(prId: number, files: { path: string; changeType: string }[]) {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO pr_files (pr_id, path, change_type) VALUES (?, ?, ?)`,
  );
  db.exec("BEGIN TRANSACTION");
  try {
    for (const f of files) {
      stmt.run(prId, f.path, f.changeType);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function queryDb(sql: string, params: unknown[] = []): unknown[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.all(...(params as (string | number | null | bigint | Uint8Array)[])) as unknown[];
}

export function getSchema(): string {
  const db = getDb();
  const tables = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as { sql: string }[];
  return tables.map((t) => t.sql).join(";\n\n");
}
