import { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Telescope,
  LogIn,
  LogOut,
  KeyRound,
  Shield,
  Terminal,
} from "lucide-react";
import { useSettingsStore } from "../store/settings";
import { configureClient, getConnectionData } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { msalAvailable } from "../auth/msalConfig";
import { usePageTitle } from "../hooks/usePageTitle";

export function Settings({ firstRun }: { firstRun?: boolean }) {
  usePageTitle(firstRun ? "Welcome" : "Settings");
  const {
    organization,
    pat,
    theme,
    authMode,
    maxPRs,
    setOrganization,
    setPat,
    setUser,
    setTheme,
    setAuthMode,
    setAzCliAuthenticated,
    setMaxPRs,
  } = useSettingsStore();
  const auth = useAuth();

  const [orgInput, setOrgInput] = useState(organization);
  const [patInput, setPatInput] = useState(pat);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    setOrgInput(organization);
    setPatInput(pat);
  }, [organization, pat]);

  const handlePatTest = async () => {
    if (!orgInput || !patInput) return;
    setTesting(true);
    setTestResult(null);

    configureClient(orgInput, "pat", async () => patInput);

    try {
      const data = await getConnectionData();
      const displayName = data.authenticatedUser.providerDisplayName;
      const userId = data.authenticatedUser.id;
      setTestResult({ ok: true, message: `Connected as ${displayName}` });
      setOrganization(orgInput);
      setPat(patInput);
      setUser(userId, displayName);
      setAuthMode("pat");
    } catch (err) {
      setTestResult({ ok: false, message: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const handleOAuthLogin = async () => {
    if (!orgInput) return;
    setLoggingIn(true);
    setTestResult(null);
    try {
      setOrganization(orgInput);
      setAuthMode("oauth");
      await auth.login();

      configureClient(orgInput, "oauth", auth.getToken);
      try {
        const data = await getConnectionData();
        setUser(data.authenticatedUser.id, data.authenticatedUser.providerDisplayName);
        setTestResult({
          ok: true,
          message: `Signed in as ${data.authenticatedUser.providerDisplayName}`,
        });
      } catch {
        setTestResult({ ok: true, message: `Signed in as ${auth.userName}` });
        if (auth.userId) setUser(auth.userId, auth.userName);
      }
    } catch (err) {
      setTestResult({ ok: false, message: (err as Error).message });
    } finally {
      setLoggingIn(false);
    }
  };

  const handleAzCliConnect = async () => {
    if (!orgInput) return;
    setTesting(true);
    setTestResult(null);

    const azCliTokenProvider = async () => {
      const res = await fetch("/api/auth/az-cli-token");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `az cli token failed: ${res.status}`);
      }
      const data = (await res.json()) as { accessToken: string };
      return data.accessToken;
    };

    configureClient(orgInput, "az-cli", azCliTokenProvider);

    try {
      const data = await getConnectionData();
      const displayName = data.authenticatedUser.providerDisplayName;
      const userId = data.authenticatedUser.id;
      setTestResult({ ok: true, message: `Connected as ${displayName}` });
      setOrganization(orgInput);
      setUser(userId, displayName);
      setAuthMode("az-cli");
      setAzCliAuthenticated(true);
    } catch (err) {
      setAzCliAuthenticated(false);
      setTestResult({ ok: false, message: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const handleOAuthLogout = async () => {
    await auth.logout();
    setTestResult(null);
  };

  const selectedMode = authMode;

  return (
    <div className={`max-w-xl ${firstRun ? "mx-auto mt-24" : "mx-auto"}`}>
      {firstRun && (
        <div className="text-center mb-8">
          <Telescope className="w-14 h-14 text-ado-blue mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Welcome to PRScope</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Connect your Azure DevOps organization to get started.
          </p>
        </div>
      )}

      {!firstRun && (
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
          <SettingsIcon className="w-6 h-6" />
          Settings
        </h1>
      )}

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">Organization</label>
          <input
            type="text"
            placeholder="my-org"
            value={orgInput}
            onChange={(e) => setOrgInput(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ado-blue/40 focus:border-ado-blue"
          />
          <p className="text-xs text-zinc-400 mt-1">
            The organization name from dev.azure.com/{"<org>"}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Authentication Method</label>
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setAuthMode("az-cli")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedMode === "az-cli"
                  ? "bg-ado-blue text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              <Terminal className="w-4 h-4" />
              Azure CLI
            </button>
            <button
              onClick={() => setAuthMode("oauth")}
              disabled={!msalAvailable}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedMode === "oauth"
                  ? "bg-ado-blue text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              } ${!msalAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Shield className="w-4 h-4" />
              Microsoft SSO
            </button>
            <button
              onClick={() => setAuthMode("pat")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedMode === "pat"
                  ? "bg-ado-blue text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              <KeyRound className="w-4 h-4" />
              Personal Access Token
            </button>
          </div>

          {selectedMode === "az-cli" && (
            <div className="space-y-3">
              {auth.isAuthenticated && authMode === "az-cli" ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm">
                    Connected as <strong>{auth.userName}</strong>
                  </span>
                </div>
              ) : (
                <>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Uses your existing{" "}
                    <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">az login</code>{" "}
                    session. No app registration or PAT needed.
                  </p>
                  <button
                    onClick={handleAzCliConnect}
                    disabled={testing || !orgInput}
                    className="flex items-center gap-2 bg-ado-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-ado-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Terminal className="w-4 h-4" />
                    )}
                    Connect via Azure CLI
                  </button>
                </>
              )}
            </div>
          )}

          {selectedMode === "oauth" && !msalAvailable && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300 mb-2">
                OAuth not configured
              </p>
              <p className="text-amber-700 dark:text-amber-400 mb-2">
                Add both values to{" "}
                <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">.env.local</code>:
              </p>
              <pre className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded text-xs font-mono">
                {`VITE_MSAL_TENANT_ID=your-tenant-id
VITE_MSAL_CLIENT_ID=your-app-client-id`}
              </pre>
              <p className="text-amber-700 dark:text-amber-400 mt-2 text-xs">
                Register a SPA app in Azure Portal {">"} Entra ID {">"} App registrations.
                <br />
                Redirect URI:{" "}
                <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">
                  http://localhost:5173
                </code>
                <br />
                API permission: Azure DevOps {">"}{" "}
                <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">
                  user_impersonation
                </code>{" "}
                (delegated). Then restart dev server.
              </p>
            </div>
          )}

          {selectedMode === "oauth" && msalAvailable && (
            <div className="space-y-3">
              {auth.authMode === "oauth" && auth.isAuthenticated ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm">
                      Signed in as <strong>{auth.userName}</strong>
                    </span>
                  </div>
                  <button
                    onClick={handleOAuthLogout}
                    className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-red-600 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleOAuthLogin}
                  disabled={loggingIn || !orgInput}
                  className="flex items-center gap-2 bg-ado-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-ado-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loggingIn ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  Sign in with Microsoft
                </button>
              )}
            </div>
          )}

          {selectedMode === "pat" && (
            <div className="space-y-3">
              <div>
                <input
                  type="password"
                  placeholder="Enter your PAT..."
                  value={patInput}
                  onChange={(e) => setPatInput(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ado-blue/40 focus:border-ado-blue"
                />
                <p className="text-xs text-zinc-400 mt-1">
                  Needs <strong>Code (Read)</strong> and <strong>Graph (Read)</strong> scopes.{" "}
                  <a
                    href="https://dev.azure.com/_usersSettings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ado-blue hover:underline"
                  >
                    Create one here
                  </a>
                </p>
              </div>
              <button
                onClick={handlePatTest}
                disabled={testing || !orgInput || !patInput}
                className="flex items-center gap-2 bg-ado-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-ado-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing && <Loader2 className="w-4 h-4 animate-spin" />}
                {firstRun ? "Connect" : "Test & Save"}
              </button>
            </div>
          )}
        </div>

        {testResult && (
          <div
            className={`flex items-center gap-2 text-sm ${testResult.ok ? "text-green-600" : "text-red-600"}`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {testResult.message}
          </div>
        )}
      </div>

      {!firstRun && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mt-4">
          <h2 className="text-sm font-semibold mb-3">PR Fetch Limit</h2>
          <p className="text-xs text-zinc-400 mb-2">
            Max PRs to fetch per query. Increase if you have a long history.
          </p>
          <div className="flex gap-2">
            {[500, 1000, 2000, 5000].map((n) => (
              <button
                key={n}
                onClick={() => setMaxPRs(n)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  maxPRs === n
                    ? "bg-ado-blue text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {n.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      )}

      {!firstRun && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mt-4">
          <h2 className="text-sm font-semibold mb-3">Appearance</h2>
          <div className="flex gap-2">
            {(["system", "light", "dark"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  theme === t
                    ? "bg-ado-blue text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
