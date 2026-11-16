import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/Avatar";
import { BookCover } from "../components/BookCover";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { useToast } from "../components/Toasts";
import { ApiError } from "../lib/api";
import { timeAgo } from "../lib/dates";
import { useAddBook, useClub, useClubMutations, useLibrary, useSearch } from "../lib/hooks";
import type { Book, ClubDetail, ClubPost } from "../lib/types";

export function ClubPage() {
  const { id = "" } = useParams();
  const club = useClub(id);
  const [pickingBook, setPickingBook] = useState(false);

  if (club.isLoading) return <div className="skeleton" style={{ height: 220 }} aria-busy="true" />;
  if (club.error) {
    const forbidden = club.error instanceof ApiError && club.error.status === 403;
    return (
      <div className="empty">
        <Icon name="clubs" size={40} />
        <p>{forbidden ? "This club is invite-only. Ask the host for an invite link." : "We couldn't find that club."}</p>
        <Link to="/clubs" className="btn btn-outline">
          Back to clubs
        </Link>
      </div>
    );
  }
  const d = club.data!;
  const isHost = d.myRole === "owner" || d.myRole === "moderator";

  return (
    <div className="club">
      <ClubHeader d={d} />

      <div className="club-grid-main">
        <div className="stack" style={{ gap: "2.5rem", minWidth: 0 }}>
          <CurrentBook d={d} isHost={isHost} onPick={() => setPickingBook(true)} />
          <Discussion d={d} />
        </div>
        <aside className="side-panel">
          <Members d={d} />
          <ClubActions d={d} />
        </aside>
      </div>

      {isHost && <BookPicker clubId={d.club.id} open={pickingBook} onClose={() => setPickingBook(false)} />}
    </div>
  );
}

function ClubHeader({ d }: { d: ClubDetail }) {
  const toast = useToast();
  const link = d.club.inviteCode ? `${window.location.origin}/join/${d.club.inviteCode}` : null;
  return (
    <header className="club-head">
      <div className="stack" style={{ gap: "0.4rem", minWidth: 0 }}>
        <Link to="/clubs" className="small muted back-link">
          All clubs
        </Link>
        <h1 className="page-title">{d.club.name}</h1>
        {d.club.description && <p className="muted" style={{ maxWidth: "60ch" }}>{d.club.description}</p>}
      </div>
      {link && (
        <button
          className="btn btn-outline btn-sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              toast("Invite link copied");
            } catch {
              toast(`Invite code: ${d.club.inviteCode}`);
            }
          }}
        >
          <Icon name="plus" size={16} /> Invite friends
        </button>
      )}
    </header>
  );
}

/** The current book, with every member's place in it on one shared track. */
function CurrentBook({ d, isHost, onPick }: { d: ClubDetail; isHost: boolean; onPick: () => void }) {
  const library = useLibrary();
  const add = useAddBook();
  const toast = useToast();
  const book = d.currentBook;

  if (!book) {
    return (
      <section className="card stack" aria-label="Current book" style={{ alignItems: "flex-start" }}>
        <p className="section-title" style={{ fontSize: "1.35rem" }}>
          No book picked yet
        </p>
        <p className="muted">{isHost ? "Choose what the club reads first." : "The host will pick the first book soon."}</p>
        {isHost && (
          <button className="btn btn-dark" onClick={onPick}>
            Choose a book
          </button>
        )}
      </section>
    );
  }

  const total = book.pageCount ?? Math.max(...d.members.map((m) => m.totalPages ?? 0), 1);
  const readers = d.members.filter((m) => m.page !== null).sort((a, b) => (a.page ?? 0) - (b.page ?? 0));
  const notStarted = d.members.filter((m) => m.page === null);
  const inMyLibrary = library.data?.some((e) => e.book.id === book.id || (book.isbn && e.book.isbn === book.isbn));

  return (
    <section aria-labelledby="cb-h" className="current-book">
      <div className="book-hero">
        <BookCover book={book} />
        <div className="stack" style={{ gap: "0.35rem", minWidth: 0 }}>
          <span className="small" style={{ color: "var(--accent-text)", fontWeight: 700 }}>
            Reading together
          </span>
          <h2 id="cb-h" className="display" style={{ fontSize: "2rem" }}>
            {book.title}
          </h2>
          <p className="muted">{book.author}</p>
          <div className="row" style={{ marginTop: "0.4rem" }}>
            {!inMyLibrary && (
              <button
                className="btn btn-dark btn-sm"
                onClick={async () => {
                  await add.mutateAsync({ book, status: "reading", owned: false });
                  toast(`Added "${book.title}" to your library`);
                }}
              >
                <Icon name="plus" size={16} /> Add to my library
              </button>
            )}
            {isHost && (
              <button className="btn btn-quiet btn-sm" onClick={onPick}>
                Change book
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="together" aria-label="Where everyone is in the book">
        <div className="together-track">
          <span className="together-start">p. 1</span>
          <span className="together-end">p. {total}</span>
          {readers.map((m, i) => {
            const pct = Math.min(100, ((m.page ?? 0) / total) * 100);
            return (
              <span
                key={m.id}
                className="together-pin"
                style={{ left: `${pct}%`, zIndex: i + 1 }}
                title={`${m.name}: page ${m.page}`}
              >
                <Avatar user={m} size={30} />
              </span>
            );
          })}
        </div>
        <ul className="together-legend">
          {[...readers].reverse().map((m) => (
            <li key={m.id}>
              <Avatar user={m} size={20} />
              {m.name.split(" ")[0]}
              <span className="muted">{m.page === total ? "finished" : `p. ${m.page}`}</span>
            </li>
          ))}
          {notStarted.map((m) => (
            <li key={m.id} className="muted">
              <Avatar user={m} size={20} />
              {m.name.split(" ")[0]} hasn't started
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Discussion({ d }: { d: ClubDetail }) {
  const top = d.posts.filter((p) => !p.parentId).reverse(); // newest threads first
  const replies = (id: string) => d.posts.filter((p) => p.parentId === id);
  return (
    <section aria-labelledby="disc-h" className="stack" style={{ gap: "1.25rem" }}>
      <h2 id="disc-h" className="section-title">
        Discussion
      </h2>
      <Composer d={d} />
      {top.length === 0 && <p className="muted">No posts yet. Start the conversation.</p>}
      <ul className="thread-list">
        {top.map((p) => (
          <li key={p.id} className="thread">
            <Post d={d} post={p} />
            {replies(p.id).length > 0 && (
              <ul className="replies">
                {replies(p.id).map((r) => (
                  <li key={r.id}>
                    <Post d={d} post={r} isReply />
                  </li>
                ))}
              </ul>
            )}
            <Composer d={d} parentId={p.id} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Post({ d, post, isReply }: { d: ClubDetail; post: ClubPost; isReply?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const { removePost } = useClubMutations(d.club.id);
  const myId = useAuth().user?.id;
  const hidden = post.hiddenAsSpoiler && !revealed;
  return (
    <article className={`post ${isReply ? "post-reply" : ""}`}>
      <Avatar user={post.author} size={isReply ? 28 : 36} />
      <div className="post-body">
        <div className="post-meta">
          <Link to={`/u/${post.author.handle}`}>
            <strong>{post.author.name}</strong>
          </Link>
          <span className="muted small">{timeAgo(post.createdAt)}</span>
          {post.spoilerUpToPage && <span className="pill">Up to p. {post.spoilerUpToPage}</span>}
          {post.canDelete && (
            <button
              className={`post-delete ${post.author.id === myId ? "is-mine" : ""}`}
              onClick={() => removePost.mutate(post.id)}
              aria-label={`Delete ${post.author.id === myId ? "your" : `${post.author.name}'s`} post`}
            >
              Delete
            </button>
          )}
        </div>
        {hidden ? (
          <div className="spoiler">
            <p className="spoiler-text" aria-hidden="true">
              {post.body}
            </p>
            <div className="spoiler-cover">
              <span className="small">
                Spoiler up to page {post.spoilerUpToPage}. You're on page {d.myPage}.
              </span>
              <button className="btn btn-outline btn-sm" onClick={() => setRevealed(true)}>
                Show anyway
              </button>
            </div>
          </div>
        ) : (
          <p className="post-text">{post.body}</p>
        )}
      </div>
    </article>
  );
}

function Composer({ d, parentId, compact }: { d: ClubDetail; parentId?: string; compact?: boolean }) {
  const { post } = useClubMutations(d.club.id);
  const [open, setOpen] = useState(!compact);
  const [body, setBody] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [page, setPage] = useState(String(d.myPage || ""));

  if (!open) {
    return (
      <button className="btn btn-quiet btn-sm reply-btn" onClick={() => setOpen(true)}>
        Reply
      </button>
    );
  }

  return (
    <form
      className={`composer ${compact ? "composer-reply" : ""}`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        await post.mutateAsync({ body: body.trim(), parentId, spoilerUpToPage: spoiler ? parseInt(page, 10) || null : null });
        setBody("");
        setSpoiler(false);
        if (compact) setOpen(false);
      }}
    >
      <label className="visually-hidden" htmlFor={`compose-${parentId ?? "new"}`}>
        {parentId ? "Write a reply" : "Write a post"}
      </label>
      <textarea
        id={`compose-${parentId ?? "new"}`}
        className="textarea"
        style={{ minHeight: compact ? 64 : 88 }}
        placeholder={parentId ? "Write a reply…" : d.currentBook ? `What do you think of ${d.currentBook.title} so far?` : "Say hello to the club…"}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={4000}
        autoFocus={compact}
      />
      <div className="row" style={{ justifyContent: "space-between" }}>
        {d.currentBook ? (
          <div className="row" style={{ gap: "0.5rem" }}>
            <button type="button" className="switch" role="switch" aria-checked={spoiler} onClick={() => setSpoiler(!spoiler)}>
              <span className="switch-track" />
              Spoiler
            </button>
            {spoiler && (
              <label className="row small" style={{ gap: "0.35rem" }}>
                up to page
                <input className="input" style={{ width: 80, minHeight: 36 }} inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))} />
              </label>
            )}
          </div>
        ) : (
          <span />
        )}
        <div className="row" style={{ gap: "0.4rem" }}>
          {compact && (
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
          )}
          <button className="btn btn-dark btn-sm" type="submit" disabled={!body.trim() || post.isPending}>
            {parentId ? "Reply" : "Post"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Members({ d }: { d: ClubDetail }) {
  return (
    <section className="stack" style={{ gap: "0.75rem" }} aria-labelledby="mem-h">
      <h2 id="mem-h" className="label">
        {d.members.length} members
      </h2>
      <ul className="people-list">
        {d.members.map((m) => (
          <li key={m.id} className="person">
            <Link to={`/u/${m.handle}`} className="person-link">
              <Avatar user={m} size={34} />
              <span className="stack" style={{ gap: 0 }}>
                <strong>{m.name}</strong>
                <span className="muted small">{m.role === "owner" ? "Host" : m.role === "moderator" ? "Co-host" : `@${m.handle}`}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClubActions({ d }: { d: ClubDetail }) {
  const { leave, remove } = useClubMutations(d.club.id);
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const isOwner = d.myRole === "owner";
  const alone = d.members.length === 1;

  return (
    <div className="stack" style={{ gap: "0.5rem", borderTop: "1px solid var(--line)", paddingTop: "1.5rem" }}>
      {confirm ? (
        <>
          <p className="small">{isOwner ? "Delete this club and its discussion for everyone?" : "Leave this club?"}</p>
          <div className="row">
            <button
              className="btn btn-danger btn-sm"
              onClick={async () => {
                if (isOwner && !alone) await remove.mutateAsync();
                else await leave.mutateAsync();
                toast(isOwner ? "Club deleted" : "You left the club");
                navigate("/clubs");
              }}
            >
              {isOwner ? "Delete club" : "Leave"}
            </button>
            <button className="btn btn-quiet btn-sm" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button className="btn btn-quiet btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setConfirm(true)}>
          {isOwner ? "Delete club" : "Leave club"}
        </button>
      )}
    </div>
  );
}

/** Host's picker: search any book, or choose from your own library. */
function BookPicker({ clubId, open, onClose }: { clubId: string; open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const search = useSearch(submitted);
  const library = useLibrary();
  const { update } = useClubMutations(clubId);
  const toast = useToast();

  useEffect(() => {
    if (!open) {
      setQ("");
      setSubmitted("");
    }
  }, [open]);

  async function pick(book: Book) {
    await update.mutateAsync({ currentBook: book });
    toast(`The club is reading ${book.title}`);
    onClose();
  }

  const list = submitted ? search.data : library.data?.filter((e) => e.status !== "finished").map((e) => e.book);

  return (
    <Sheet open={open} onClose={onClose} title="Choose the club's book" wide>
      <form
        className="row"
        style={{ flexWrap: "nowrap" }}
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(q.trim());
        }}
      >
        <label htmlFor="club-book-q" className="visually-hidden">
          Search books
        </label>
        <input id="club-book-q" className="input" placeholder="Search any book" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-dark" type="submit">
          Search
        </button>
      </form>
      <span className="label">{submitted ? `Results for "${submitted}"` : "From your library"}</span>
      {submitted && search.isLoading && <p className="muted">Searching…</p>}
      <ul className="results" style={{ listStyle: "none", padding: 0 }}>
        {list?.map((b) => (
          <li key={b.id} className="result">
            <BookCover book={b} />
            <div className="result-body">
              <div className="result-title">{b.title}</div>
              <div className="muted small">{b.author}</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => pick(b)} disabled={update.isPending}>
              Choose
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
