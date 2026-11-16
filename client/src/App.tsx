import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { Icon, type IconName } from "./components/Icon";
import { SignIn } from "./pages/SignIn";
import { LibraryPage } from "./pages/Library";
import { DiscoverPage } from "./pages/Discover";
import { SettingsPage } from "./pages/Settings";
import { LendingPage } from "./pages/Lending";
import { ProfilePage } from "./pages/Profile";

/** Placeholder for sections that arrive in later stages. */
function Soon({ title, icon, note }: { title: string; icon: IconName; note: string }) {
  return (
    <div className="empty">
      <Icon name={icon} size={40} />
      <h1 className="page-title" style={{ color: "var(--text)" }}>
        {title}
      </h1>
      <p>{note}</p>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="boot" role="status">
        Opening your library…
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<SignIn />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/library" replace />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="discover" element={<DiscoverPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="lending" element={<LendingPage />} />
        <Route path="clubs" element={<Soon title="Book clubs" icon="clubs" note="Book clubs are coming soon." />} />
        <Route path="u/:handle" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/library" replace />} />
      </Route>
    </Routes>
  );
}
