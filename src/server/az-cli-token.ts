import type { ServerResponse } from "http";
import { execSync } from "child_process";

const ADO_RESOURCE = "499b84ac-1321-427f-aa17-267ca6975798";

let cachedToken: { token: string; expiresOn: number } | null = null;

export function handleAzCliTokenRequest(_req: unknown, res: ServerResponse): void {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresOn > now + 60_000) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ accessToken: cachedToken.token }));
    return;
  }

  console.log("[az-cli-token] Fetching new token from az cli...");
  try {
    const raw = execSync(`az account get-access-token --resource ${ADO_RESOURCE} -o json`, {
      encoding: "utf-8",
      timeout: 15_000,
    });
    const parsed = JSON.parse(raw) as {
      accessToken: string;
      expiresOn: string;
    };
    cachedToken = {
      token: parsed.accessToken,
      expiresOn: new Date(parsed.expiresOn).getTime(),
    };
    console.log("[az-cli-token] Token acquired, expires %s", parsed.expiresOn);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ accessToken: cachedToken.token }));
  } catch (err) {
    console.error("[az-cli-token] Failed:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Failed to get token from az cli. Run `az login` first.",
        details: String(err),
      }),
    );
  }
}
