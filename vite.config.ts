import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { execSync } from "child_process";
import { handleLLMChatRequest } from "./src/server/copilot-llm";

const ADO_RESOURCE = "499b84ac-1321-427f-aa17-267ca6975798";

function azCliTokenPlugin(): Plugin {
  let cachedToken: { token: string; expiresOn: number } | null = null;

  return {
    name: "az-cli-token",
    configureServer(server) {
      server.middlewares.use("/api/auth/az-cli-token", (_req, res) => {
        const now = Date.now();
        if (cachedToken && cachedToken.expiresOn > now + 60_000) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ accessToken: cachedToken.token }));
          return;
        }

        try {
          const raw = execSync(
            `az account get-access-token --resource ${ADO_RESOURCE} -o json`,
            { encoding: "utf-8", timeout: 15_000 },
          );
          const parsed = JSON.parse(raw) as {
            accessToken: string;
            expiresOn: string;
          };
          cachedToken = {
            token: parsed.accessToken,
            expiresOn: new Date(parsed.expiresOn).getTime(),
          };
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ accessToken: cachedToken.token }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: "Failed to get token from az cli. Run `az login` first.",
              details: String(err),
            }),
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    azCliTokenPlugin(),
    {
      name: "copilot-llm",
      configureServer(server) {
        server.middlewares.use(
          "/api/llm/chat",
          handleLLMChatRequest as Parameters<typeof server.middlewares.use>[1],
        );
      },
    },
  ],
  server: {
    proxy: {
      "/api/ado": {
        target: "https://dev.azure.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ado/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const pat = req.headers["x-ado-pat"] as string | undefined;
            if (pat) {
              proxyReq.setHeader(
                "Authorization",
                `Basic ${Buffer.from(":" + pat).toString("base64")}`,
              );
              proxyReq.removeHeader("x-ado-pat");
            }
          });
        },
      },
      "/api/vssps": {
        target: "https://vssps.dev.azure.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/vssps/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const pat = req.headers["x-ado-pat"] as string | undefined;
            if (pat) {
              proxyReq.setHeader(
                "Authorization",
                `Basic ${Buffer.from(":" + pat).toString("base64")}`,
              );
              proxyReq.removeHeader("x-ado-pat");
            }
          });
        },
      },
    },
  },
});
