import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { handleAzCliTokenRequest } from "./src/server/az-cli-token";
import { handleLLMChatRequest } from "./src/server/copilot-llm";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "az-cli-token",
      configureServer(server) {
        server.middlewares.use(
          "/api/auth/az-cli-token",
          handleAzCliTokenRequest as Parameters<typeof server.middlewares.use>[1],
        );
      },
    },
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
