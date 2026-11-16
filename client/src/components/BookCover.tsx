import { useState } from "react";
import type { Book } from "../lib/types";

/** Cover colors for books with no cover image, picked so white or black text always passes contrast. */
const PALETTE: { bg: string; fg: string }[] = [
  { bg: "#1f3b5c", fg: "#ffffff" },
  { bg: "#2f5d4a", fg: "#ffffff" },
  { bg: "#f2c14e", fg: "#141414" },
  { bg: "#ece6dc", fg: "#141414" },
  { bg: "#6b2b23", fg: "#f6e7c8" },
  { bg: "#d63a24", fg: "#ffffff" },
  { bg: "#3d3a6b", fg: "#ffffff" },
  { bg: "#c9a35a", fg: "#141414" },
];

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

type Props = {
  book: Pick<Book, "title" | "author" | "coverUrl">;
  /** @deprecated the fallback title now scales with the cover width */
  size?: number;
  className?: string;
  children?: React.ReactNode;
};

/** A book cover image, or a generated typographic cover when there is no image (or it fails to load). */
export function BookCover({ book, className = "", children }: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = book.coverUrl && !failed;
  const { bg, fg } = PALETTE[hash(book.title) % PALETTE.length];

  return (
    <div className={`cover ${className}`} style={showImage ? undefined : { background: bg, color: fg }}>
      {showImage ? (
        <img src={book.coverUrl!} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="cover-type" lang="en" aria-hidden="true">
          <span className="cover-type-title">{book.title}</span>
          {book.author && <span className="cover-type-author">{book.author.split(",")[0]}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
