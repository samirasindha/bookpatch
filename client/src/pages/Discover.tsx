import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookCover } from "../components/BookCover";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toasts";
import { useAddBook, useLibrary, useSearch } from "../lib/hooks";
import type { Book, ReadingStatus } from "../lib/types";

const IDEAS = ["Toni Morrison", "Cozy mysteries", "Ursula K. Le Guin", "Magical realism", "Essays", "Ocean Vuong", "Historical fiction", "Poetry"];

export function DiscoverPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [text, setText] = useState(q);
  const search = useSearch(q);
  const library = useLibrary();
  const add = useAddBook();
  const toast = useToast();

  useEffect(() => setText(q), [q]);

  const inLibrary = new Map(library.data?.map((e) => [e.book.isbn ?? e.book.id, e]) ?? []);
  const has = (b: Book) => inLibrary.has(b.isbn ?? b.id) || inLibrary.has(b.id);

  async function addBook(book: Book, status: ReadingStatus, owned: boolean) {
    const res = await add.mutateAsync({ book, status, owned });
    toast(res.alreadyInLibrary ? `"${book.title}" is already in your library` : `Added "${book.title}"`);
  }

  return (
    <>
      <h1 className="page-title">Find your next book.</h1>

      <form
        className="discover-head"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setParams(text.trim() ? { q: text.trim() } : {});
        }}
      >
        <div className="search-wrap">
          <Icon name="search" />
          <label htmlFor="search" className="visually-hidden">
            Search by title, author, or ISBN
          </label>
          <input
            id="search"
            className="input input-search"
            type="search"
            placeholder="Title, author, or ISBN"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <button className="btn btn-dark" type="submit" style={{ minHeight: 52 }}>
          Search
        </button>
      </form>

      {!q && (
        <section aria-labelledby="ideas">
          <h2 id="ideas" className="label" style={{ marginBottom: "0.75rem" }}>
            Need an idea?
          </h2>
          <div className="suggestions">
            {IDEAS.map((idea) => (
              <button key={idea} className="chip" onClick={() => setParams({ q: idea })}>
                {idea}
              </button>
            ))}
          </div>
        </section>
      )}

      {q && search.isLoading && (
        <p className="muted" role="status">
          Searching…
        </p>
      )}
      {q && search.isError && <p className="form-error">Search isn't working right now. Try again in a moment.</p>}
      {q && search.data?.length === 0 && (
        <div className="empty">
          <Icon name="search" size={36} />
          <p>No books found for "{q}". Try fewer words, or the ISBN from the back cover.</p>
        </div>
      )}

      {!!search.data?.length && (
        <ul className="results" aria-label={`Results for ${q}`} style={{ listStyle: "none", padding: 0 }}>
          {search.data.map((b) => (
            <li key={b.id} className="result">
              <BookCover book={b} size={8} />
              <div className="result-body">
                <div className="result-title">{b.title}</div>
                <div className="muted small">
                  {b.author ?? "Unknown author"}
                  {b.publishedYear ? ` · ${b.publishedYear}` : ""}
                  {b.pageCount ? ` · ${b.pageCount} pages` : ""}
                </div>
              </div>
              {has(b) ? (
                <span className="pill pill-success">
                  <Icon name="check" size={14} /> In your library
                </span>
              ) : (
                <div className="row" style={{ gap: "0.4rem", justifyContent: "flex-end" }}>
                  <button className="btn btn-outline btn-sm" onClick={() => addBook(b, "want_to_read", false)}>
                    Want to read
                  </button>
                  <button className="btn btn-dark btn-sm" onClick={() => addBook(b, "want_to_read", true)} aria-label={`I own ${b.title}`}>
                    <Icon name="plus" size={16} /> I own it
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
