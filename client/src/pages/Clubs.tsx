import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookCover } from "../components/BookCover";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { useToast } from "../components/Toasts";
import { plural, timeAgo } from "../lib/dates";
import { useClubMutations, useClubs } from "../lib/hooks";
import type { ClubSummary } from "../lib/types";

export function ClubsPage() {
  const clubs = useClubs();
  const { join } = useClubMutations();
  const navigate = useNavigate();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);

  async function joinWithCode(e: React.FormEvent) {
    e.preventDefault();
    // Accept a full invite link or just the code
    const c = code.trim().split("/").pop() ?? "";
    if (!c) return;
    try {
      const r = await join.mutateAsync({ code: c });
      navigate(`/clubs/${r.clubId}`);
    } catch {
      toast("That invite code didn't match a club");
    }
  }

  return (
    <>
      <div className="home-head">
        <h1 className="page-title">
          Read together.
          <br />
          <em>Talk about it after.</em>
        </h1>
        <button className="btn btn-accent" onClick={() => setCreating(true)}>
          <Icon name="plus" size={18} /> Start a club
        </button>
      </div>

      {clubs.isLoading ? (
        <div className="club-grid" aria-busy="true">
          <div className="skeleton" style={{ height: 150 }} />
          <div className="skeleton" style={{ height: 150 }} />
        </div>
      ) : clubs.data?.mine.length ? (
        <section aria-labelledby="my-clubs">
          <h2 id="my-clubs" className="visually-hidden">
            Your clubs
          </h2>
          <ul className="club-grid">
            {clubs.data.mine.map((c) => (
              <ClubCard key={c.id} club={c} />
            ))}
          </ul>
        </section>
      ) : (
        <div className="empty">
          <Icon name="clubs" size={40} />
          <p className="section-title" style={{ color: "var(--text)" }}>
            No clubs yet
          </p>
          <p>Start one and invite friends with a link, or join one with a code.</p>
        </div>
      )}

      <div className="clubs-lower">
        <form className="card stack" onSubmit={joinWithCode} aria-labelledby="join-h">
          <h2 id="join-h" className="section-title" style={{ fontSize: "1.35rem" }}>
            Have an invite?
          </h2>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <label htmlFor="invite" className="visually-hidden">
              Invite code or link
            </label>
            <input id="invite" className="input" placeholder="Paste the code or link" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn btn-dark" type="submit" disabled={join.isPending}>
              Join
            </button>
          </div>
        </form>

        {!!clubs.data?.discover.length && (
          <section className="stack" aria-labelledby="open-clubs">
            <h2 id="open-clubs" className="section-title" style={{ fontSize: "1.35rem" }}>
              Open clubs
            </h2>
            <ul className="people-list">
              {clubs.data.discover.map((c) => (
                <li key={c.id} className="person">
                  <span className="stack" style={{ gap: 0 }}>
                    <strong>{c.name}</strong>
                    <span className="muted small">
                      {plural(c.memberCount, "member")}
                      {c.currentBook ? ` · reading ${c.currentBook.title}` : ""}
                    </span>
                  </span>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={async () => {
                      const r = await join.mutateAsync({ clubId: c.id });
                      navigate(`/clubs/${r.clubId}`);
                    }}
                  >
                    Join
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <CreateClubSheet open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function ClubCard({ club }: { club: ClubSummary }) {
  return (
    <li>
      <Link to={`/clubs/${club.id}`} className="club-card">
        {club.currentBook ? (
          <BookCover book={club.currentBook} />
        ) : (
          <div className="cover club-cover-empty" aria-hidden="true">
            <Icon name="book" size={28} />
          </div>
        )}
        <span className="stack" style={{ gap: "0.3rem", minWidth: 0 }}>
          <span className="club-card-name">{club.name}</span>
          <span className="muted small">
            {club.currentBook ? (
              <>
                Reading <em>{club.currentBook.title}</em>
              </>
            ) : (
              "No book picked yet"
            )}
          </span>
          <span className="muted small">
            {plural(club.memberCount, "member")} · active {timeAgo(club.lastActivityAt)}
          </span>
          {club.myRole === "owner" && <span className="pill" style={{ alignSelf: "flex-start" }}>You host</span>}
        </span>
      </Link>
    </li>
  );
}

function CreateClubSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useClubMutations();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setPrivate] = useState(true);

  return (
    <Sheet open={open} onClose={onClose} title="Start a club">
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await create.mutateAsync({ name: name.trim(), description: description.trim() || undefined, isPrivate });
          setName("");
          setDescription("");
          onClose();
          navigate(`/clubs/${r.club.id}`);
        }}
      >
        <label className="field">
          <span className="label">Club name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunday Classics" minLength={2} maxLength={60} required />
        </label>
        <label className="field">
          <span className="label">What's it about? (optional)</span>
          <textarea className="textarea" style={{ minHeight: 80 }} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} placeholder="One classic a month, read slowly." />
        </label>
        <button type="button" className="switch" role="switch" aria-checked={isPrivate} onClick={() => setPrivate(!isPrivate)}>
          <span className="switch-track" />
          Invite only
        </button>
        <p className="muted small" style={{ marginTop: "-0.5rem" }}>
          {isPrivate ? "People join with your invite link." : "Anyone can find and join this club."}
        </p>
        <button className="btn btn-accent" type="submit" disabled={create.isPending || name.trim().length < 2} style={{ alignSelf: "flex-start" }}>
          Create club
        </button>
      </form>
    </Sheet>
  );
}
