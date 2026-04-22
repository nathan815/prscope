import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { Layout } from "./components/Layout";
import { ToastContainer } from "./components/Toast";
import { MyPRs } from "./pages/MyPRs";
import { Repos } from "./pages/Repos";
import { Feed } from "./pages/Feed";
import { Settings } from "./pages/Settings";
import { Profile } from "./pages/Profile";
import { People } from "./pages/People";
import { useSettingsStore } from "./store/settings";
import { useAuth } from "./auth/useAuth";
import { configureClient } from "./api/client";

export default function App() {
  const theme = useSettingsStore((s) => s.theme);
  const organization = useSettingsStore((s) => s.organization);
  const { isAuthenticated, authMode, getToken } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      configureClient(organization, authMode, getToken);
    }
  }, [isAuthenticated, organization, authMode, getToken]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(prefersDark ? "dark" : "light");
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  if (!isAuthenticated) {
    return (
      <>
        <Routes>
          <Route path="*" element={<Settings firstRun />} />
        </Routes>
        <ToastContainer />
      </>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<MyPRs />} />
        <Route path="/repos" element={<Repos />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/people" element={<People />} />
        <Route path="/profile/:userId" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </Layout>
  );
}
