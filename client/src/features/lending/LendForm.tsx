import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../../components/Avatar";
import { Icon } from "../../components/Icon";
import { useToast } from "../../components/Toasts";
import { shortDate } from "../../lib/dates";
import { useFriends, useLend } from "../../lib/hooks";
import type { Entry } from "../../lib/types";

const inTwoWeeks = () => new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

/** "Lend this book" inside a book's details: pick a friend, or type anyone's name. */
export function LendSection({ entry, onLent }: { entry: Entry; onLent: () => void }) {
  const [open, setOpen] = useState(false);
  const [friend, setFriend] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [due, setDue] = useState(inTwoWeeks());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const friends = useFriends();
  const lend = useLend();
  const toast = useToast();

  if (entry.activeLoan) {
    return (
      <div className="lend-status">
        <Icon name="lend" size={18} />
        <span>
          Lent to <strong>{entry.activeLoan.borrowerName}</strong>
          {entry.activeLoan.dueDate ? `, due ${shortDate(entry.activeLoan.dueDate)}` : ""}.
        </span>
        <Link to="/lending" className="small">
          See the card
        </Link>
      </div>
    );
  }
  if (!entry.owned) return null;
  if (!open) {
    return (
      <button type="button" className="btn btn-outline" onClick={() => setOpen(true)} style={{ alignSelf: "flex-start" }}>
        <Icon name="lend" size={18} /> Lend this book
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!friend && !name.trim()) return setError("Choose a friend or type a name");
    try {
      await lend.mutateAsync({
        userBookId: entry.id,
        ...(friend ? { borrowerHandle: friend } : { borrowerName: name.trim(), borrowerEmail: email.trim() }),
        dueDate: due,
        notes: notes.trim() || undefined,
      });
      toast(`Checkout card made for ${friend ? friends.data?.find((f) => f.handle === friend)?.name : name.trim()}`);
      onLent();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form className="lend-form" onSubmit={submit} aria-labelledby="lend-h">
      <h3 id="lend-h" className="label">
        Lend this book
      </h3>
      {!!friends.data?.length && (
        <div className="field">
          <span className="small muted">To a friend</span>
          <div className="shelf-toggles" role="radiogroup" aria-label="Friend">
            {friends.data.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={friend === f.handle}
                className="chip"
                aria-pressed={friend === f.handle}
                onClick={() => {
                  setFriend(friend === f.handle ? null : f.handle);
                  setName("");
                }}
              >
                <Avatar user={f} size={20} /> {f.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {!friend && (
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="field" style={{ flex: "1 1 160px" }}>
            <span className="small muted">{friends.data?.length ? "Or someone not on bookpatch" : "Who's borrowing it?"}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Their name" />
          </label>
          <label className="field" style={{ flex: "1 1 200px" }}>
            <span className="small muted">Email, for nudges (optional)</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </label>
        </div>
      )}
      <div className="row" style={{ alignItems: "flex-end" }}>
        <label className="field" style={{ flex: "0 1 180px" }}>
          <span className="small muted">Due back</span>
          <input className="input" type="date" value={due} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDue(e.target.value)} />
        </label>
        <label className="field" style={{ flex: "1 1 200px" }}>
          <span className="small muted">Note on the card (optional)</span>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Signed copy, be gentle" maxLength={500} />
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button className="btn btn-accent" type="submit" disabled={lend.isPending}>
          Make checkout card
        </button>
        <button className="btn btn-quiet" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
