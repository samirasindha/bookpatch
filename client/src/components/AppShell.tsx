import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "./Logo";
import { Icon, type IconName } from "./Icon";
import { Avatar } from "./Avatar";

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/library", label: "Library", icon: "library" },
  { to: "/discover", label: "Discover", icon: "search" },
  { to: "/lending", label: "Lending", icon: "lend" },
  { to: "/clubs", label: "Clubs", icon: "clubs" },
];

export function AppShell() {
  const { user, signOut } = useAuth();

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="topbar">
        <NavLink to="/library" className="topbar-brand" aria-label="STACKS home">
          <Logo size={26} />
        </NavLink>

        <nav className="topbar-nav" aria-label="Main">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className="nav-link">
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="topbar-actions">
          {user?.isDemo && <span className="demo-pill">Demo</span>}
          <NavLink to="/settings" className="icon-btn" aria-label="Settings">
            <Icon name="settings" />
          </NavLink>
          <NavLink to={`/u/${user?.handle}`} className="avatar-link" aria-label="Your profile">
            {user && <Avatar user={user} size={32} />}
          </NavLink>
          <button className="icon-btn" onClick={() => void signOut()} aria-label="Sign out">
            <Icon name="logout" />
          </button>
        </div>
      </header>

      <main id="main" className="page" tabIndex={-1}>
        <Outlet />
      </main>

      {/* Phone-sized screens get a thumb-friendly tab bar instead of the top nav */}
      <nav className="tabbar" aria-label="Main">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className="tab-link">
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <NavLink to={`/u/${user?.handle}`} className="tab-link">
          <Icon name="user" size={22} />
          <span>Me</span>
        </NavLink>
      </nav>
    </>
  );
}
