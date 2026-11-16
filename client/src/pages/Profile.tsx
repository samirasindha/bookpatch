import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { BookCover } from "../components/BookCover";
import { Icon } from "../components/Icon";
import { StarDisplay } from "../components/Stars";
import { useToast } from "../components/Toasts";
import { useFollow, useFriends, usePeopleSearch, useProfile } from "../lib/hooks";
import { plural } from "../lib/dates";
import type { Profile, ProfileEntry } from "../lib/types";

export function ProfilePage() {
  const { handle = "" } = useParams();
  const profile = useProfile(handle);

  if (profile.isLoading) return <div className="skeleton" style={{ height: 160 }} aria-busy="true" />;
  if (profile.isError || !profile.data) {
    return (
      <div className="empty">
        <Icon name="user" size={40} />
        <p>We couldn't find @{handle}.</p>
      </div>
    );
  }
  const p = profile.data;
  const self = p.relationship.isSelf;

  return (
    <div className="profile">
      <ProfileHeader p={p} />

      {!p.visible ? (
        <div className="empty card">
          <Icon name="library" size={36} />
          <p>
            {p.libraryVisibility === "friends"
              ? `${p.user.name.split(" ")[0]}'s library is just for friends. When you follow each other, it'll show up here.`
              : `${p.user.name.split(" ")[0]} keeps their library private.`}
          </p>
        </div>
      ) : (
        <div className="profile-grid">
          <div className="stack" style={{ gap: "2.5rem" }}>
            {!!p.shelf!.reading.length && (
              <section aria-labelledby="p-reading">
                <h2 id="p-reading" className="section-title" style={{ marginBottom: "1rem" }}>
                  Reading now
                </h2>
                <div className="now-reading">
                  {p.shelf!.reading.map((e) => (
                    <div key={e.id} className="now-card" style={{ cursor: "default" }}>
                      <BookCover book={e.book} />
                      <span className="now-card-body">
                        <span className="now-card-title">{e.book.title}</span>
                        <span className="muted small">{e.book.author}</span>
                        {!!(e.totalPages ?? e.book.pageCount) && (
                          <span className="progress" style={{ marginTop: "0.5rem" }} aria-hidden="true">
                            <span style={{ width: `${Math.min(100, (e.progress / (e.totalPages ?? e.book.pageCount!)) * 100)}%` }} />
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!!p.shelf!.recentlyFinished.length && (
              <section aria-labelledby="p-finished">
                <h2 id="p-finished" className="section-title" style={{ marginBottom: "1rem" }}>
                  Recently finished
                </h2>
                <ul className="review-list">
                  {p.shelf!.recentlyFinished.map((e) => (
                    <ReviewItem key={e.id} e={e} />
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="p-shelf">
              <h2 id="p-shelf" className="section-title" style={{ marginBottom: "1rem" }}>
                {self ? "Your patch" : `${p.user.name.split(" ")[0]}'s patch`}
                <span className="muted small" style={{ fontFamily: "var(--font-body)", fontWeight: 400, marginLeft: "0.6rem" }}>
                  {plural(p.shelf!.library.length, "book")}
                </span>
              </h2>
              <ul className="shelf-grid shelf-grid-sm" style={{ listStyle: "none", padding: 0 }}>
                {p.shelf!.library.slice(0, 30).map((e) => (
                  <li key={e.id} className="book-tile" style={{ cursor: "default" }}>
                    <BookCover book={e.book} />
                    <span className="book-tile-title">{e.book.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="side-panel">
            {p.shelf!.goal && (
              <div className="stack" style={{ gap: "0.6rem" }}>
                <span className="label">{new Date().getFullYear()} goal</span>
                <span className="goal-num">
                  {p.shelf!.goal.finishedThisYear}
                  <span> / {p.shelf!.goal.target}</span>
                </span>
                <div className="progress progress-accent" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (p.shelf!.goal.finishedThisYear / p.shelf!.goal.target) * 100)}%` }} />
                </div>
              </div>
            )}
            {self && <FindFriends />}
          </aside>
        </div>
      )}
      {!p.visible && self && <FindFriends />}
    </div>
  );
}

function ProfileHeader({ p }: { p: Profile }) {
  const follow = useFollow();
  const toast = useToast();
  const r = p.relationship;
  const first = p.user.name.split(" ")[0];

  return (
    <header className="profile-head">
      <Avatar user={p.user} size={88} />
      <div className="stack" style={{ gap: "0.35rem", flex: 1, minWidth: 0 }}>
        <h1 className="page-title">{p.user.name}</h1>
        <p className="muted">
          @{p.user.handle}
          {r.followedBy && !r.friends && <span className="pill" style={{ marginLeft: "0.5rem" }}>Follows you</span>}
          {r.friends && (
            <span className="pill pill-success" style={{ marginLeft: "0.5rem" }}>
              Friends
            </span>
          )}
        </p>
        {p.user.bio && <p style={{ maxWidth: "52ch" }}>{p.user.bio}</p>}
        <p className="small muted profile-counts">
          <span>
            <strong>{p.counts.books}</strong> books
          </span>
          <span>
            <strong>{p.counts.finished}</strong> finished
          </span>
          <span>
            <strong>{p.counts.followers}</strong> followers
          </span>
          <span>
            <strong>{p.counts.following}</strong> following
          </span>
        </p>
      </div>
      {r.isSelf ? (
        <Link to="/settings#profile" className="btn btn-outline btn-sm">
          Edit profile
        </Link>
      ) : (
        <button
          className={`btn btn-sm ${r.following ? "btn-outline" : "btn-accent"}`}
          disabled={follow.isPending}
          onClick={async () => {
            const res = await follow.mutateAsync({ handle: p.user.handle, follow: !r.following });
            if (res.relationship.friends) toast(`You and ${first} are friends now`);
          }}
        >
          {r.following ? "Following" : r.followedBy ? "Follow back" : "Follow"}
        </button>
      )}
    </header>
  );
}

function ReviewItem({ e }: { e: ProfileEntry }) {
  return (
    <li className="review-item">
      <BookCover book={e.book} />
      <div className="stack" style={{ gap: "0.3rem", minWidth: 0 }}>
        <span className="result-title">{e.book.title}</span>
        <span className="muted small">{e.book.author}</span>
        {e.rating && <StarDisplay value={e.rating} />}
        {e.review && <p className="review-text">{e.review}</p>}
      </div>
    </li>
  );
}

function FindFriends() {
  const [q, setQ] = useState("");
  const results = usePeopleSearch(q);
  const friends = useFriends();
  const follow = useFollow();
  const list = q.trim() ? results.data : friends.data;

  return (
    <section className="stack" style={{ gap: "0.75rem", borderTop: "1px solid var(--line)", paddingTop: "1.75rem" }} aria-labelledby="ff-h">
      <h2 id="ff-h" className="label">
        {q.trim() ? "People" : "Following"}
      </h2>
      <div className="search-wrap">
        <Icon name="search" size={18} />
        <label htmlFor="people-q" className="visually-hidden">
          Find people by name or handle
        </label>
        <input id="people-q" className="input input-search" style={{ minHeight: 44, fontSize: "0.95rem" }} placeholder="Find friends" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="people-list">
        {list?.map((u) => {
          const following = "following" in u ? u.following : true;
          return (
            <li key={u.id} className="person">
              <Link to={`/u/${u.handle}`} className="person-link">
                <Avatar user={u} size={36} />
                <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                  <strong>{u.name}</strong>
                  <span className="muted small">@{u.handle}</span>
                </span>
              </Link>
              {"friends" in u && u.friends ? (
                <span className="pill pill-success">Friends</span>
              ) : (
                !following && (
                  <button className="btn btn-outline btn-sm" onClick={() => follow.mutate({ handle: u.handle, follow: true })}>
                    Follow
                  </button>
                )
              )}
            </li>
          );
        })}
        {q.trim() && results.data?.length === 0 && <li className="muted small">No one found for "{q}".</li>}
        {!q.trim() && friends.data?.length === 0 && <li className="muted small">Search for friends by name to follow them.</li>}
      </ul>
    </section>
  );
}
