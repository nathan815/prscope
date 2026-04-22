# PRScope

Azure DevOps PR dashboard for engineers who work across many repos. View your PRs, track reviews, follow teammates, and get AI-powered profile summaries.

## Features

- **My PRs** — View PRs you created and are assigned to review, across all repos in your selected projects. Filter by status, time range, and repo.
- **User Profiles** — Contribution graph, top repos, review impact analysis with comment history, and AI-generated summaries.
- **Activity Feed** — Social feed of PR activity from people you follow. Incrementally cached for fast loads.
- **People** — Search and follow teammates across your ADO org.
- **Repos** — Browse and favorite repos with virtual scrolling (handles 16k+ repos).

## Prerequisites

- An [Azure DevOps](https://dev.azure.com) organization
- Node.js 20+
- One of the following for authentication:
  - **Azure CLI** (easiest) — just `az login`
  - **MSAL OAuth** — requires an Azure AD app registration
  - **Personal Access Token** — manual, not recommended. Some orgs restrict PAT creation or enforce a short max lifetime.

### Optional

- **GitHub Copilot subscription** — powers the AI Summary feature on profiles. Without it, everything else works fine.

## Setup

```bash
git clone https://github.com/nathan815/prscope.git
cd prscope
npm install
```

### Authentication

**Azure CLI (easiest):**

```bash
az login
npm run dev
```

Open http://localhost:5173, enter your ADO org name, select "Azure CLI", and click Connect.

**OAuth/MSAL:**

1. Register a SPA in Azure Portal > Entra ID > App registrations
2. Add redirect URI: `http://localhost:5173`
3. Add API permission: Azure DevOps > `user_impersonation` (delegated)
4. Create `.env.local`:
   ```
   VITE_MSAL_CLIENT_ID=your-client-id
   VITE_MSAL_TENANT_ID=your-tenant-id
   ```
5. `npm run dev`

**PAT:**
Select "Personal Access Token" in Settings and paste a token with Code (Read) and Graph (Read) scopes.

### First Run

1. Go to **Repos** tab and select your project(s)
2. Star repos you care about
3. **My PRs** will now show your PRs across all selected projects

## AI Summaries

Profile pages have a "Generate Summary" button that uses [GitHub Copilot SDK](https://www.npmjs.com/package/@github/copilot-sdk) to analyze PR activity and produce structured insights (focus areas, work style, review thoroughness, strengths, collaborators).

Requires:

- GitHub Copilot subscription
- `gh auth login` (the SDK authenticates via your GitHub CLI credentials)

The SDK bundles its own Copilot CLI subprocess — no separate Copilot CLI installation needed. Summaries are cached locally for 7 days. Without Copilot, all other features work normally.

## Development

```bash
npm run dev      # Start dev server
npm run build    # Production build
npx vitest       # Run tests
npx tsc --noEmit # Type check
```

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- TanStack Query + React Virtual
- Zustand (state management)
- MSAL for OAuth, Azure CLI for dev auth
- GitHub Copilot SDK for AI summaries
- IndexedDB for API response caching

## License

[MIT](LICENSE)
