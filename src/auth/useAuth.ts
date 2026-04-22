import { useCallback, useMemo } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useSettingsStore } from "../store/settings";
import { adoScopes, msalInstance } from "./msalConfig";

type MsalHook = typeof import("@azure/msal-react").useMsal;
type IsAuthHook = typeof import("@azure/msal-react").useIsAuthenticated;

let _useMsal: MsalHook | null = null;
let _useIsAuthenticated: IsAuthHook | null = null;

export function registerMsalHooks(useMsal: MsalHook, useIsAuthenticated: IsAuthHook) {
  _useMsal = useMsal;
  _useIsAuthenticated = useIsAuthenticated;
}

export type AuthMode = "oauth" | "pat" | "az-cli";

export interface AuthState {
  isAuthenticated: boolean;
  authMode: AuthMode;
  userName: string;
  userId: string;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string>;
}

export function useAuth(): AuthState {
  const authMode = useSettingsStore((s) => s.authMode);
  const pat = useSettingsStore((s) => s.pat);
  const organization = useSettingsStore((s) => s.organization);
  const storedUserName = useSettingsStore((s) => s.userDisplayName);
  const storedUserId = useSettingsStore((s) => s.userId);

  const msalState = _useMsal?.() ?? null;
  const oauthAuthenticated = _useIsAuthenticated?.() ?? false;

  const oauthAccount = msalState?.accounts?.[0] ?? null;

  const azCliAuthenticated = useSettingsStore((s) => s.azCliAuthenticated);

  const isAuthenticated = useMemo(() => {
    if (authMode === "oauth") {
      return oauthAuthenticated && organization.length > 0;
    }
    if (authMode === "az-cli") {
      return azCliAuthenticated && organization.length > 0;
    }
    return organization.length > 0 && pat.length > 0;
  }, [authMode, oauthAuthenticated, azCliAuthenticated, organization, pat]);

  const userName =
    authMode === "oauth" ? storedUserName || (oauthAccount?.name ?? "") : storedUserName;

  const userId =
    authMode === "oauth" ? storedUserId || (oauthAccount?.localAccountId ?? "") : storedUserId;

  const login = useCallback(async () => {
    if (authMode === "oauth" && msalInstance) {
      await msalInstance.loginPopup({ scopes: adoScopes });
    }
  }, [authMode]);

  const logout = useCallback(async () => {
    if (authMode === "oauth" && msalInstance) {
      await msalInstance.logoutPopup();
    }
  }, [authMode]);

  const getToken = useCallback(async (): Promise<string> => {
    if (authMode === "pat") {
      return pat;
    }

    if (authMode === "az-cli") {
      const res = await fetch("/api/auth/az-cli-token");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `az cli token failed: ${res.status}`);
      }
      const data = (await res.json()) as { accessToken: string };
      return data.accessToken;
    }

    if (!msalInstance || !oauthAccount) {
      throw new Error("Not authenticated with MSAL");
    }

    try {
      const response = await msalInstance.acquireTokenSilent({
        scopes: adoScopes,
        account: oauthAccount,
      });
      return response.accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        const response = await msalInstance.acquireTokenPopup({
          scopes: adoScopes,
          account: oauthAccount,
        });
        return response.accessToken;
      }
      throw err;
    }
  }, [authMode, pat, oauthAccount]);

  return { isAuthenticated, authMode, userName, userId, login, logout, getToken };
}
