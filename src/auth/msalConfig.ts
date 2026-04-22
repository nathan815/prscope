import { PublicClientApplication, type Configuration, LogLevel } from "@azure/msal-browser";

const ADO_RESOURCE_ID = "499b84ac-1321-427f-aa17-267ca6975798";

const clientId = import.meta.env["VITE_MSAL_CLIENT_ID"] as string | undefined;
const tenantId = import.meta.env["VITE_MSAL_TENANT_ID"] as string | undefined;

export const msalAvailable = Boolean(clientId && tenantId);

export const adoScopes = [`${ADO_RESOURCE_ID}/.default`];

const msalConfig: Configuration = {
  auth: {
    clientId: clientId ?? "",
    authority: `https://login.microsoftonline.com/${tenantId ?? "common"}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "localStorage",
  },
  system: {
    loggerOptions: {
      loggerCallback: (_level, message, containsPii) => {
        if (!containsPii && import.meta.env.DEV) console.debug("[MSAL]", message);
      },
      logLevel: LogLevel.Warning,
    },
  },
};

export const msalInstance = msalAvailable ? new PublicClientApplication(msalConfig) : null;
