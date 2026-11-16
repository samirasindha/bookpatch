import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { SignIn } from "./pages/SignIn";
import { LibraryPage } from "./pages/Library";
import { DiscoverPage } from "./pages/Discover";
import { SettingsPage } from "./pages/Settings";
import { LendingPage } from "./pages/Lending";
import { ProfilePage } from "./pages/Profile";
import { ClubsPage } from "./pages/Clubs";
import { ClubPage } from "./pages/Club";
import { JoinClubPage } from "./pages/JoinClub";

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
        <Route path="clubs" element={<ClubsPage />} />
        <Route path="clubs/:id" element={<ClubPage />} />
        <Route path="join/:code" element={<JoinClubPage />} />
        <Route path="u/:handle" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/library" replace />} />
      </Route>
    </Routes>
  );
}
