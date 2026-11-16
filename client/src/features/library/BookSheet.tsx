import { useState } from "react";
import { Sheet } from "../../components/Sheet";
import { BookCover } from "../../components/BookCover";
import { StarInput } from "../../components/Stars";
import { LendSection } from "../lending/LendForm";
import { useToast } from "../../components/Toasts";
import { useRemoveEntry, useShelves, useUpdateEntry } from "../../lib/hooks";
import { STATUS_LABEL, type Entry, type ReadingStatus } from "../../lib/types";

const STATUSES: ReadingStatus[] = ["want_to_read", "reading", "finished", "dnf"];

/** Everything about one book in your library: status, progress, rating, review, shelves. */
export function BookSheet({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  return (
    <Sheet open={!!entry} onClose={onClose} title={entry?.book.title ?? "Book"} hideTitle>
      {entry && <BookForm key={entry.id} entry={entry} onDone={onClose} />}
    </Sheet>
  );
}

function BookForm({ entry, onDone }: { entry: Entry; onDone: () => void }) {
  const [status, setStatus] = useState(entry.status);
  const [owned, setOwned] = useState(entry.owned);
  const [progress, setProgress] = useState(String(entry.progress || ""));
  const [total, setTotal] = useState(String(entry.totalPages ?? entry.book.pageCount ?? ""));
  const [rating, setRating] = useState(entry.rating);
  const [review, setReview] = useState(entry.review ?? "");
  const [shelfIds, setShelfIds] = useState(entry.shelfIds);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const shelves = useShelves();
  const update = useUpdateEntry();
  const remove = useRemoveEntry();
  const toast = useToast();

  const totalNum = parseInt(total, 10) || null;
  const progressNum = Math.min(parseInt(progress, 10) || 0, totalNum ?? Infinity);
  const pct = totalNum ? Math.round((progressNum / totalNum) * 100) : 0;
  const { book } = entry;

  async function save() {
    await update.mutateAsync({
      id: entry.id,
      status,
      owned,
      totalPages: totalNum,
      rating,
      review: review.trim() || null,
      shelfIds,
      // Finishing a book fills the progress bar unless you typed a page number
      ...(status === "finished" && !progress ? {} : { progress: progressNum }),
    });
    toast("Saved");
    onDone();
  }

  async function doRemove() {
    await remove.mutateAsync(entry.id);
    toast(`Removed "${book.title}"`);
    onDone();
  }

  return (
    <>
      <div className="book-hero">
        <BookCover book={book} size={13} />
        <div className="stack" style={{ gap: "0.35rem", minWidth: 0 }}>
          <h3 className="display" style={{ fontSize: "1.9rem" }}>
            {book.title}
          </h3>
          <p className="muted">
            {book.author}
            {book.publishedYear ? ` · ${book.publishedYear}` : ""}
          </p>
          {book.isbn && <p className="muted small">ISBN {book.isbn}</p>}
        </div>
      </div>

      <div className="field">
        <span className="label" id="status-label">
          Status
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="status-label">
          {STATUSES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => setStatus(s)}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="switch" role="switch" aria-checked={owned} onClick={() => setOwned(!owned)}>
        <span className="switch-track" />I own a copy
      </button>

      {(status === "reading" || status === "dnf") && (
        <div className="field">
          <span className="label">Progress</span>
          <div className="pages-row">
            <label className="visually-hidden" htmlFor="progress">
              Current page
            </label>
            <input id="progress" className="input" inputMode="numeric" value={progress} onChange={(e) => setProgress(e.target.value.replace(/\D/g, ""))} />
            <span className="muted">of</span>
            <label className="visually-hidden" htmlFor="total">
              Total pages
            </label>
            <input id="total" className="input" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))} />
            <span className="muted small">{totalNum ? `${pct}%` : "pages"}</span>
          </div>
          <div className="progress progress-accent" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="field">
        <span className="label">Your rating</span>
        <StarInput value={rating} onChange={setRating} />
      </div>

      <div className="field">
        <label className="label" htmlFor="review">
          Notes and review
        </label>
        <textarea id="review" className="textarea" value={review} onChange={(e) => setReview(e.target.value)} placeholder="What stayed with you?" />
      </div>

      {!!shelves.data?.length && (
        <div className="field">
          <span className="label" id="shelves-label">
            Shelves
          </span>
          <div className="shelf-toggles" role="group" aria-labelledby="shelves-label">
            {shelves.data.map((s) => {
              const on = shelfIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  className="chip"
                  aria-pressed={on}
                  onClick={() => setShelfIds(on ? shelfIds.filter((x) => x !== s.id) : [...shelfIds, s.id])}
                >
                  <span className="chip-dot" style={{ background: s.color }} />
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <LendSection entry={{ ...entry, owned }} onLent={onDone} />

      <div className="spread" style={{ alignItems: "center" }}>
        {confirmRemove ? (
          <div className="row">
            <span className="small">Remove from your library?</span>
            <button className="btn btn-danger btn-sm" onClick={doRemove}>
              Yes, remove
            </button>
            <button className="btn btn-quiet btn-sm" onClick={() => setConfirmRemove(false)}>
              Keep it
            </button>
          </div>
        ) : (
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmRemove(true)}>
            Remove
          </button>
        )}
        <button className="btn btn-dark" onClick={save} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}
