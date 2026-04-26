import { execSync } from "child_process";

const ADO_RESOURCE = "499b84ac-1321-427f-aa17-267ca6975798";

let cachedToken: { token: string; expiresOn: number } | null = null;

function getAzCliToken(): string | null {
  try {
    const now = Date.now();
    if (cachedToken && cachedToken.expiresOn > now + 60_000) {
      return cachedToken.token;
    }
    console.log("[ado-api] Fetching az cli token...");
    const raw = execSync(`az account get-access-token --resource ${ADO_RESOURCE} -o json`, {
      encoding: "utf-8",
      timeout: 15_000,
    });
    const parsed = JSON.parse(raw) as { accessToken: string; expiresOn: string };
    cachedToken = {
      token: parsed.accessToken,
      expiresOn: new Date(parsed.expiresOn).getTime(),
    };
    console.log("[ado-api] Token acquired, expires %s", parsed.expiresOn);
    return cachedToken.token;
  } catch {
    return null;
  }
}

export function resolveToken(authHeader: string | undefined): string {
  const fromHeader = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const fromCli = getAzCliToken();
  const token = fromCli ?? fromHeader;
  if (!token) throw new Error("No ADO token available. Run `az login` or authenticate via OAuth.");
  return token;
}

export async function adoFetch<T>(
  token: string,
  org: string,
  path: string,
  base: "ado" | "vssps" = "ado",
  init?: { method?: string; body?: string },
): Promise<T> {
  const baseUrl = base === "ado" ? "https://dev.azure.com" : "https://vssps.dev.azure.com";
  const url = `${baseUrl}/${org}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (init?.body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { headers, method: init?.method, body: init?.body });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ADO API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}
