import { useEffect, useRef, useState } from "react";
import { Sheet } from "../../components/Sheet";
import { BookCover } from "../../components/BookCover";
import { Icon } from "../../components/Icon";
import { useToast } from "../../components/Toasts";
import { lookupIsbn, useBulkAdd, useLibrary } from "../../lib/hooks";
import { ApiError } from "../../lib/api";
import { STATUS_LABEL, type Book, type ReadingStatus } from "../../lib/types";
import { CameraScanner } from "./CameraScanner";
import { looksLikeIsbn } from "./useHandheldScanner";

type Item = { key: string; isbn: string; state: "loading" | "found" | "missing" | "error"; book?: Book; inLibrary?: boolean };

const isTouch = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/** A short confirmation beep, like a checkout scanner. */
function beep(ok: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 1320 : 330;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    navigator.vibrate?.(ok ? 40 : [30, 40, 30]);
  } catch {
    /* sound is a nice-to-have */
  }
}

/**
 * Rapid shelving: scan book after book (handheld scanner, camera, or typing),
 * watch them stack up in a list, then add them all at once.
 */
export function ScanSheet({ open, onClose, initialIsbn }: { open: boolean; onClose: () => void; initialIsbn: string | null }) {
  const [mode, setMode] = useState<"handheld" | "camera">(isTouch() ? "camera" : "handheld");
  const [items, setItems] = useState<Item[]>([]);
  const [owned, setOwned] = useState(true);
  const [status, setStatus] = useState<ReadingStatus>("want_to_read");
  const [typed, setTyped] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const library = useLibrary();
  const bulk = useBulkAdd();
  const toast = useToast();
  const seen = useRef(new Set<string>());

  const libraryIsbns = new Set(library.data?.map((e) => e.book.isbn).filter(Boolean));

  function enqueue(raw: string) {
    const isbn = raw.replace(/[-\s]/g, "").toUpperCase();
    if (!looksLikeIsbn(isbn)) {
      beep(false);
      toast("That doesn't look like a book barcode");
      return;
    }
    if (seen.current.has(isbn)) return; // the camera sees the same barcode many times a second
    seen.current.add(isbn);
    const key = `${isbn}-${Date.now()}`;
    setItems((prev) => [{ key, isbn, state: "loading" }, ...prev]);

    lookupIsbn(isbn)
      .then((book) => {
        beep(true);
        setItems((prev) =>
          prev.map((i) => (i.key === key ? { ...i, state: "found", book, inLibrary: !!book.isbn && libraryIsbns.has(book.isbn) } : i)),
        );
      })
      .catch((e) => {
        beep(false);
        setItems((prev) => prev.map((i) => (i.key === key ? { ...i, state: e instanceof ApiError && e.status === 404 ? "missing" : "error" } : i)));
      });
  }

  // Opened by a scan that happened elsewhere in the app
  useEffect(() => {
    if (open && initialIsbn) enqueue(initialIsbn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialIsbn]);

  useEffect(() => {
    if (open && mode === "handheld") setTimeout(() => input.current?.focus(), 50);
  }, [open, mode]);

  function close() {
    setItems([]);
    seen.current.clear();
    onClose();
  }

  const ready = items.filter((i) => i.state === "found" && !i.inLibrary);

  async function addAll() {
    const res = await bulk.mutateAsync(ready.map((i) => ({ book: i.book!, status, owned })));
    toast(`Added ${res.added} book${res.added === 1 ? "" : "s"} to your library`);
    close();
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Scan books"
      wide
      footer={
        <>
          <span className="muted small">
            {items.length ? `${ready.length} ready to add` : "Scanned books appear here"}
          </span>
          <button className="btn btn-accent" disabled={!ready.length || bulk.isPending} onClick={addAll}>
            {bulk.isPending ? "Adding…" : `Add ${ready.length || ""} to library`}
          </button>
        </>
      }
    >
      <div className="segmented" role="tablist" aria-label="Scan with">
        <button role="tab" aria-selected={mode === "handheld"} onClick={() => setMode("handheld")}>
          Handheld scanner
        </button>
        <button role="tab" aria-selected={mode === "camera"} onClick={() => setMode("camera")}>
          Camera
        </button>
      </div>

      {mode === "camera" && open && <CameraScanner onCode={enqueue} />}

      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) enqueue(typed.trim());
          setTyped("");
        }}
      >
        <label htmlFor="isbn-input" className="label">
          {mode === "handheld" ? "Scan now: each barcode is added as you go" : "Or type an ISBN"}
        </label>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input
            ref={input}
            id="isbn-input"
            className="input"
            inputMode="numeric"
            autoComplete="off"
            placeholder="978…"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <button className="btn btn-outline" type="submit">
            Look up
          </button>
        </div>
      </form>

      <div className="row">
        <span className="label">Add as</span>
        <div className="segmented" role="radiogroup" aria-label="Reading status for scanned books">
          {(["want_to_read", "reading", "finished"] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => setStatus(s)}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <button type="button" className="switch" role="switch" aria-checked={owned} onClick={() => setOwned(!owned)}>
          <span className="switch-track" />I own these
        </button>
      </div>

      {items.length > 0 && (
        <ul className="scan-queue" aria-label="Scanned books" style={{ listStyle: "none", padding: 0 }}>
          {items.map((i) => (
            <li key={i.key} className="scan-item">
              {i.book ? <BookCover book={i.book} size={6} /> : <div className="cover skeleton" style={{ width: 38 }} />}
              <div className="scan-item-body">
                <div className="scan-item-title">
                  {i.state === "loading" && "Looking up…"}
                  {i.state === "found" && i.book!.title}
                  {i.state === "missing" && "Not found in any catalog"}
                  {i.state === "error" && "Lookup failed. Check your connection."}
                </div>
                <div className="muted small">{i.book?.author ?? `ISBN ${i.isbn}`}</div>
              </div>
              {i.inLibrary && <span className="pill">Already yours</span>}
              {i.state === "found" && !i.inLibrary && (
                <span className="pill pill-success">
                  <Icon name="check" size={14} /> Ready
                </span>
              )}
              <button
                className="icon-btn"
                aria-label={`Remove ${i.book?.title ?? i.isbn} from the list`}
                onClick={() => {
                  seen.current.delete(i.isbn);
                  setItems((prev) => prev.filter((x) => x.key !== i.key));
                }}
              >
                <Icon name="close" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
