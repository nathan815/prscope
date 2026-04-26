import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { handleLLMChatRequest } from "./src/server/copilot-llm";
import {
  handleConnectionData,
  handleProjects,
  handleRepositories,
  handlePullRequests,
  handleThreads,
  handlePRFiles,
  handleSearchIdentities,
  handleAvatar,
  handleDbQuery,
  handleDbSchema,
} from "./src/server/ado-api";

type Handler = Parameters<
  ReturnType<
    typeof defineConfig extends (...args: infer A) => infer R ? never : never
  > extends never
    ? never
    : never
>[0];

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "prscope-api",
      configureServer(server) {
        const use = (path: string, handler: Function) =>
          server.middlewares.use(path, handler as Parameters<typeof server.middlewares.use>[1]);

        use("/api/ado/connection-data", handleConnectionData);
        use("/api/ado/projects", handleProjects);
        use("/api/ado/repositories", handleRepositories);
        use("/api/ado/pull-requests", handlePullRequests);
        use("/api/ado/threads", handleThreads);
        use("/api/ado/pr-files", handlePRFiles);
        use("/api/ado/search-identities", handleSearchIdentities);
        use("/api/ado/avatar", handleAvatar);
        use("/api/db/query", handleDbQuery);
        use("/api/db/schema", handleDbSchema);
        use("/api/llm/chat", handleLLMChatRequest);
      },
    },
  ],
});
