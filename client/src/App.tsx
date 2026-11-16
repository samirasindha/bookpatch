import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { SignIn } from "./pages/SignIn";
import { ComingSoon } from "./pages/ComingSoon";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="boot" role="status" aria-live="polite">
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
        <Route path="library" element={<ComingSoon title="Library" icon="library" />} />
        <Route path="discover" element={<ComingSoon title="Discover" icon="search" />} />
        <Route path="lending" element={<ComingSoon title="Lending" icon="lend" />} />
        <Route path="clubs" element={<ComingSoon title="Book Clubs" icon="clubs" />} />
        <Route path="settings" element={<ComingSoon title="Settings" icon="settings" />} />
        <Route path="u/:handle" element={<ComingSoon title="Profile" icon="user" />} />
        <Route path="*" element={<Navigate to="/library" replace />} />
      </Route>
    </Routes>
  );
}
