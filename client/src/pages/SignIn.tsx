import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { GoogleButton } from "../auth/GoogleButton";
import { Logo } from "../components/Logo";
import { Icon } from "../components/Icon";
import { api } from "../lib/api";
import type { AuthConfig } from "../lib/types";

const FEATURES = [
  { icon: "scan", title: "Scan your shelves", text: "Point your camera at a barcode and the book is in your library." },
  { icon: "lend", title: "Lend with a checkout card", text: "Know who has your books, and send a friendly nudge when it's time." },
  { icon: "clubs", title: "Read together", text: "Follow friends, see their shelves, and start a book club." },
] as const;

export function SignIn() {
  const { signInWithGoogle, signInAsDemo } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const config = useQuery({ queryKey: ["auth-config"], queryFn: () => api<AuthConfig>("/auth/config") });

  const handleGoogle = useCallback(
    (credential: string) => {
      setError(null);
      signInWithGoogle(credential).catch((e: Error) => setError(e.message));
    },
    [signInWithGoogle],
  );

  const handleDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInAsDemo();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="signin" id="main">
      <section className="signin-hero">
        <Logo size={34} />
        <h1 className="signin-title">
          Every book you own, <em>read, and lend</em>, in one place.
        </h1>
        <ul className="signin-features">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className="signin-feature-icon">
                <Icon name={f.icon} size={22} />
              </span>
              <div>
                <strong>{f.title}</strong>
                <p>{f.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="signin-card" aria-labelledby="signin-heading">
        <h2 id="signin-heading">Open your library</h2>
        <p className="muted">Sign in to sync your books across devices and connect with friends.</p>

        <div className="signin-actions">
          {config.data?.googleClientId && (
            <GoogleButton clientId={config.data.googleClientId} onCredential={handleGoogle} />
          )}
          {config.data?.demoLogin && (
            <>
              {config.data.googleClientId && <div className="or-divider"><span>or</span></div>}
              <button className="btn btn-ghost btn-wide" onClick={handleDemo} disabled={busy}>
                <Icon name="book" size={18} />
                {busy ? "Opening demo…" : "Explore the demo library"}
              </button>
            </>
          )}
          {config.isSuccess && !config.data.googleClientId && !config.data.demoLogin && (
            <p className="muted small">Sign-in isn't configured yet. Add GOOGLE_CLIENT_ID to the server's .env file.</p>
          )}
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
