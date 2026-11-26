import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { GoogleButton } from "../auth/GoogleButton";
import { BookCover } from "../components/BookCover";
import { Icon } from "../components/Icon";
import { Logo } from "../components/Logo";
import { api, waitForServer } from "../lib/api";
import type { AuthConfig } from "../lib/types";

// Typographic covers only (no real cover art) for the hero
const HERO_BOOKS = [
  { title: "Middlemarch", author: "George Eliot", coverUrl: null },
  { title: "Jane Eyre", author: "Charlotte Brontë", coverUrl: null },
  { title: "The Odyssey", author: "Homer", coverUrl: null },
  { title: "Persuasion", author: "Jane Austen", coverUrl: null },
  { title: "Dracula", author: "Bram Stoker", coverUrl: null },
];

export function SignIn() {
  const { signInWithGoogle, signInAsDemo } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const config = useQuery({
    queryKey: ["auth-config"],
    queryFn: () => api<AuthConfig>("/auth/config"),
    ...waitForServer,
  });

  const handleGoogle = useCallback(
    (credential: string) => {
      setError(null);
      signInWithGoogle(credential).catch((e: Error) => setError(e.message));
    },
    [signInWithGoogle],
  );

  async function demo() {
    setBusy(true);
    setError(null);
    try {
      await signInAsDemo();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="signin" id="main">
      <section className="signin-art">
        <Logo variant="full" className="signin-logo" />
        <p className="signin-headline" aria-hidden="true">
          Every book you own, <em>read, and lend.</em>
        </p>
        <div className="signin-covers" aria-hidden="true">
          {HERO_BOOKS.map((b) => (
            <BookCover key={b.title} book={b} size={14} />
          ))}
        </div>
      </section>

      <section className="signin-panel" aria-labelledby="signin-h">
        <h1 id="signin-h" className="section-title" style={{ fontSize: "2.2rem" }}>
          Open your library
        </h1>
        <ul className="signin-points">
          <li>
            <Icon name="scan" size={18} /> Scan your shelves into a library in minutes
          </li>
          <li>
            <Icon name="lend" size={18} /> Lend books and remember who has them
          </li>
          <li>
            <Icon name="clubs" size={18} /> Read along with friends and book clubs
          </li>
        </ul>

        {config.data?.googleClientId && <GoogleButton clientId={config.data.googleClientId} onCredential={handleGoogle} />}
        {config.data?.demoLogin && (
          <>
            {config.data.googleClientId && <div className="or-divider">or</div>}
            <button className="btn btn-outline btn-wide" onClick={demo} disabled={busy}>
              {busy ? "Setting up your demo library…" : "Explore the demo"}
            </button>
            <p className="muted small">The demo comes with a library of classics to try things out. No account needed.</p>
          </>
        )}
        {config.isPending && (
          <p className="muted small" role="status">
            Loading sign-in options…
          </p>
        )}
        {config.isError && (
          <div className="signin-problem" role="alert">
            <p className="muted small">Couldn't load sign-in options. Is the server running?</p>
            <button className="btn btn-outline btn-wide" onClick={() => config.refetch()}>
              Try again
            </button>
          </div>
        )}
        {config.isSuccess && !config.data.googleClientId && !config.data.demoLogin && (
          <p className="muted small">Sign-in isn't set up yet. Add GOOGLE_CLIENT_ID to the server's .env file.</p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
