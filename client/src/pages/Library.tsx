import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { BookCover } from "../components/BookCover";
import { Icon } from "../components/Icon";
import { StarDisplay } from "../components/Stars";
import { BookSheet } from "../features/library/BookSheet";
import { useGoals, useLibrary, useShelves, useStats } from "../lib/hooks";
import { STATUS_LABEL, type Entry } from "../lib/types";

type Filter = { kind: "all" } | { kind: "status"; value: Entry["status"] } | { kind: "owned" } | { kind: "shelf"; id: string };
type Sort = "recent" | "title" | "author" | "rating" | "finished";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const pct = (e: Entry) => {
  const total = e.totalPages ?? e.book.pageCount;
  return total ? Math.min(100, Math.round((e.progress / total) * 100)) : 0;
};

export function LibraryPage() {
  const { user } = useAuth();
  const library = useLibrary();
  const shelves = useShelves();
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [sort, setSort] = useState<Sort>("recent");
  const [openId, setOpenId] = useState<string | null>(null);

  const entries = library.data ?? [];
  const reading = entries.filter((e) => e.status === "reading");
  const openEntry = entries.find((e) => e.id === openId) ?? null;

  const visible = useMemo(() => {
    let list = entries.filter((e) => {
      switch (filter.kind) {
        case "status":
          return e.status === filter.value;
        case "owned":
          return e.owned;
        case "shelf":
          return e.shelfIds.includes(filter.id);
        default:
          return true;
      }
    });
    const by = (f: (e: Entry) => string | number) => (a: Entry, b: Entry) => (f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0);
    if (sort === "title") list = [...list].sort(by((e) => e.book.title.toLowerCase()));
    if (sort === "author") list = [...list].sort(by((e) => (e.book.author ?? "~").toLowerCase()));
    if (sort === "rating") list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (sort === "finished") list = [...list].sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
    return list;
  }, [entries, filter, sort]);

  const isOn = (f: Filter) => JSON.stringify(f) === JSON.stringify(filter);
  const count = (pred: (e: Entry) => boolean) => entries.filter(pred).length;

  return (
    <>
      <div className="home-head">
        <h1 className="page-title">
          {greeting()}, {user?.name.split(" ")[0]}.
          <br />
          <em>{reading.length ? "Pick up where you left off." : "What are you reading next?"}</em>
        </h1>
      </div>

      <div className="home-grid">
        <div>
          {reading.length > 0 && (
            <section aria-labelledby="now-heading" style={{ marginBottom: "2.5rem" }}>
              <h2 id="now-heading" className="visually-hidden">
                Currently reading
              </h2>
              <div className="now-reading">
                {reading.map((e) => (
                  <button key={e.id} className="now-card" onClick={() => setOpenId(e.id)}>
                    <BookCover book={e.book} size={15} />
                    <span className="now-card-body">
                      <span className="small" style={{ color: "var(--accent-text)", fontWeight: 700 }}>
                        Reading now
                      </span>
                      <span className="now-card-title">{e.book.title}</span>
                      <span className="muted small">{e.book.author}</span>
                      <span className="progress" style={{ marginTop: "0.6rem" }} aria-hidden="true">
                        <span style={{ width: `${pct(e)}%` }} />
                      </span>
                      <span className="muted small">
                        {e.totalPages || e.book.pageCount ? `Page ${e.progress} of ${e.totalPages ?? e.book.pageCount} · ${pct(e)}%` : "Tap to log your page"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="shelf-heading">
            <div className="spread">
              <h2 id="shelf-heading" className="section-title">
                Your shelf
              </h2>
              <label className="row small muted" style={{ gap: "0.4rem" }}>
                Sort
                <select className="select" style={{ minHeight: 36, width: "auto", padding: "0 0.6rem" }} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="recent">Recently added</option>
                  <option value="title">Title</option>
                  <option value="author">Author</option>
                  <option value="rating">Your rating</option>
                  <option value="finished">Recently finished</option>
                </select>
              </label>
            </div>

            <div className="toolbar">
              <div className="chips" role="group" aria-label="Filter your shelf">
                <button className="chip" aria-pressed={isOn({ kind: "all" })} onClick={() => setFilter({ kind: "all" })}>
                  All <span className="count">{entries.length}</span>
                </button>
                {(["reading", "want_to_read", "finished"] as const).map((s) => (
                  <button key={s} className="chip" aria-pressed={isOn({ kind: "status", value: s })} onClick={() => setFilter({ kind: "status", value: s })}>
                    {STATUS_LABEL[s]} <span className="count">{count((e) => e.status === s)}</span>
                  </button>
                ))}
                <button className="chip" aria-pressed={isOn({ kind: "owned" })} onClick={() => setFilter({ kind: "owned" })}>
                  Owned <span className="count">{count((e) => e.owned)}</span>
                </button>
                {shelves.data?.map((s) => (
                  <button key={s.id} className="chip" aria-pressed={isOn({ kind: "shelf", id: s.id })} onClick={() => setFilter({ kind: "shelf", id: s.id })}>
                    <span className="chip-dot" style={{ background: s.color }} />
                    {s.name} <span className="count">{s.bookCount}</span>
                  </button>
                ))}
              </div>
            </div>

            {library.isLoading ? (
              <div className="shelf-grid" aria-busy="true">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="cover skeleton" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="empty">
                <Icon name="library" size={40} />
                <p className="section-title" style={{ color: "var(--text)" }}>
                  {entries.length ? "Nothing on this shelf yet" : "Your library is empty"}
                </p>
                <p>Scan the barcodes on your books, or search for one to add.</p>
                <Link to="/discover" className="btn btn-dark">
                  Find a book
                </Link>
              </div>
            ) : (
              <ul className="shelf-grid" style={{ listStyle: "none", padding: 0 }}>
                {visible.map((e) => (
                  <li key={e.id}>
                    <button className="book-tile" onClick={() => setOpenId(e.id)} aria-label={`${e.book.title}, ${STATUS_LABEL[e.status]}`}>
                      <BookCover book={e.book} />
                      <span className="book-tile-title">{e.book.title}</span>
                      <span className="book-tile-meta">
                        {e.rating ? <StarDisplay value={e.rating} /> : e.status === "reading" ? `${pct(e)}% read` : STATUS_LABEL[e.status]}
                        {e.owned && <span className="owned-mark"> · Owned</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="side-panel" aria-label="Reading summary">
          <GoalSummary />
          <StatsSummary />
        </aside>
      </div>

      <BookSheet entry={openEntry} onClose={() => setOpenId(null)} />
    </>
  );
}

function GoalSummary() {
  const goals = useGoals();
  const g = goals.data;
  if (!g) return <div className="skeleton" style={{ height: 120 }} />;
  if (!g.goal) {
    return (
      <div className="stack" style={{ gap: "0.5rem" }}>
        <span className="label">{g.year} reading goal</span>
        <p className="muted small">Set a goal to track your pace through the year.</p>
        <Link to="/settings#goal" className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }}>
          Set a goal
        </Link>
      </div>
    );
  }
  const { target, period } = g.goal;
  const finished = g.progress!.finished;
  const pace = g.progress!.pace;
  const periodLabel = period === "year" ? String(g.year) : `This ${period}`;
  return (
    <div className="stack" style={{ gap: "0.6rem" }}>
      <span className="label">{periodLabel} goal</span>
      <div className="spread" style={{ alignItems: "center" }}>
        <span className="goal-num">
          {finished}
          <span> / {target}</span>
        </span>
        {pace && (
          <span className={`pill ${pace === "behind" ? "pill-warn" : "pill-success"}`}>
            {pace === "ahead" ? "Ahead of pace" : pace === "on_track" ? "On pace" : "Behind pace"}
          </span>
        )}
      </div>
      <div className="progress progress-accent" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={finished} aria-label="Goal progress">
        <span style={{ width: `${Math.min(100, (finished / target) * 100)}%` }} />
      </div>
      <span className="muted small">
        {g.progress!.remaining ? `${g.progress!.remaining} to go` : "Goal reached. Nice work!"}
      </span>
    </div>
  );
}

function StatsSummary() {
  const stats = useStats();
  const s = stats.data;
  if (!s) return null;
  const items = [
    { label: "Books", value: s.total },
    { label: "Finished", value: s.finished },
    { label: "Owned", value: s.owned },
    { label: "Avg rating", value: s.avgRating ?? "None" },
  ];
  return (
    <div className="stack" style={{ gap: "0.85rem", borderTop: "1px solid var(--line)", paddingTop: "1.75rem" }}>
      <span className="label">At a glance</span>
      <dl className="stat-list">
        {items.map((i) => (
          <div key={i.label}>
            <dt className="muted small">{i.label}</dt>
            <dd className="stat-val" style={{ margin: 0 }}>
              {i.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
