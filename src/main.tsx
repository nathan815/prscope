import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { MsalProvider, useMsal, useIsAuthenticated } from '@azure/msal-react';
import App from './App';
import { msalAvailable, msalInstance } from './auth/msalConfig';
import { registerMsalHooks } from './auth/useAuth';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

if (msalAvailable) {
  registerMsalHooks(useMsal, useIsAuthenticated);
}

function MsalWrapper({ children }: { children: ReactNode }) {
  if (msalAvailable && msalInstance) {
    return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
  }
  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <MsalWrapper>
          <App />
        </MsalWrapper>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
