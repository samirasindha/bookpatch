import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "./Logo";
import { Icon, type IconName } from "./Icon";
import { Avatar } from "./Avatar";
import { NotificationsButton } from "./NotificationsButton";
import { ScanSheet } from "../features/scan/ScanSheet";
import { useHandheldScanner } from "../features/scan/useHandheldScanner";

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/library", label: "Library", icon: "library" },
  { to: "/discover", label: "Discover", icon: "search" },
  { to: "/lending", label: "Lending", icon: "lend" },
  { to: "/clubs", label: "Clubs", icon: "clubs" },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const [scanOpen, setScanOpen] = useState(false);
  const [firstScan, setFirstScan] = useState<string | null>(null);

  // A handheld USB/Bluetooth scanner "types" an ISBN and presses Enter.
  // Catch that anywhere in the app and open rapid shelving with the book already in the queue.
  useHandheldScanner((isbn) => {
    setFirstScan(isbn);
    setScanOpen(true);
  }, !scanOpen);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="header">
        <NavLink to="/library" className="wordmark" aria-label="bookpatch, go to your library">
          <Logo />
        </NavLink>
        <nav className="header-nav" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className="nav-link">
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          {user?.isDemo && <span className="demo-pill hide-mobile">Demo</span>}
          <button className="btn btn-accent btn-sm" onClick={() => setScanOpen(true)}>
            <Icon name="scan" size={18} />
            Scan
          </button>
          <NotificationsButton />
          <NavLink to="/settings" className="icon-btn hide-mobile" aria-label="Settings">
            <Icon name="settings" />
          </NavLink>
          <button className="icon-btn hide-mobile" onClick={() => void signOut()} aria-label="Sign out">
            <Icon name="logout" />
          </button>
          {user && (
            <NavLink to={`/u/${user.handle}`} className="avatar-btn hide-mobile" aria-label="Your profile">
              <Avatar user={user} size={32} />
            </NavLink>
          )}
        </div>
      </header>

      <main id="main" className="page" tabIndex={-1}>
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className="tab-link">
            <Icon name={n.icon} size={22} />
            {n.label}
          </NavLink>
        ))}
        {user && (
          <NavLink to={`/u/${user.handle}`} className="tab-link">
            <Icon name="user" size={22} />
            Me
          </NavLink>
        )}
      </nav>

      <ScanSheet
        open={scanOpen}
        initialIsbn={firstScan}
        onClose={() => {
          setScanOpen(false);
          setFirstScan(null);
        }}
      />
    </>
  );
}
