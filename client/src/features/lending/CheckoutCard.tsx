import { Link } from "react-router-dom";
import { BookCover } from "../../components/BookCover";
import { Icon } from "../../components/Icon";
import { useToast } from "../../components/Toasts";
import { ApiError } from "../../lib/api";
import { daysSince, daysUntil, plural, shortDate } from "../../lib/dates";
import { useNudge, useReturnLoan } from "../../lib/hooks";
import type { Loan } from "../../lib/types";

type Props = { loan: Loan; perspective: "lender" | "borrower" | "history" };

/**
 * A digital library checkout card: who has the book, since when, and when it's due,
 * with the due date "stamped" like an old library card.
 */
export function CheckoutCard({ loan, perspective }: Props) {
  const nudge = useNudge();
  const ret = useReturnLoan();
  const toast = useToast();

  const due = loan.dueDate ? daysUntil(loan.dueDate) : null;
  const overdue = perspective !== "history" && due !== null && due < 0;
  const counterpart = perspective === "borrower" ? loan.lender : loan.borrower;
  const counterpartName = perspective === "borrower" ? loan.lender.name : loan.borrowerName;
  const canNudge = perspective === "lender" && (loan.borrower || loan.borrowerEmail);
  const nudgedToday = loan.lastNudgeAt && Date.now() - new Date(loan.lastNudgeAt).getTime() < 86_400_000;

  async function sendNudge() {
    try {
      const r = await nudge.mutateAsync(loan.id);
      toast(
        r.channel === "in_app"
          ? `Nudged ${loan.borrowerName}`
          : r.delivered
            ? `Emailed ${loan.borrowerName} a reminder`
            : "Nudge saved. Email isn't set up yet, so no email went out.",
      );
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't send the nudge");
    }
  }

  return (
    <article className={`checkout ${overdue ? "is-overdue" : ""}`} aria-label={`${loan.book.title}, ${perspective === "borrower" ? "borrowed from" : "lent to"} ${counterpartName}`}>
      <BookCover book={loan.book} />
      <div className="checkout-body">
        <h3 className="checkout-title">{loan.book.title}</h3>
        <p className="muted small">{loan.book.author}</p>

        <dl className="checkout-grid">
          <div>
            <dt>{perspective === "borrower" ? "Lent by" : "Borrower"}</dt>
            <dd>
              {counterpart ? <Link to={`/u/${counterpart.handle}`}>{counterpartName}</Link> : counterpartName}
            </dd>
          </div>
          <div>
            <dt>Out since</dt>
            <dd>
              {shortDate(loan.loanedAt)} <span className="muted small">({plural(daysSince(loan.loanedAt), "day")})</span>
            </dd>
          </div>
          {perspective === "history" ? (
            <div>
              <dt>Returned</dt>
              <dd>{loan.returnedAt ? shortDate(loan.returnedAt, true) : ""}</dd>
            </div>
          ) : (
            <div>
              <dt>Date due</dt>
              <dd>
                {loan.dueDate ? (
                  <span className={`stamp ${overdue ? "stamp-late" : ""}`}>{shortDate(loan.dueDate).toUpperCase()}</span>
                ) : (
                  <span className="muted">No due date</span>
                )}
              </dd>
            </div>
          )}
        </dl>

        {loan.notes && <p className="checkout-note">"{loan.notes}"</p>}

        {perspective !== "history" && (
          <div className="checkout-actions">
            {overdue && <span className="pill pill-accent">{plural(-due!, "day")} overdue</span>}
            {due !== null && due >= 0 && due <= 3 && <span className="pill pill-warn">Due {due === 0 ? "today" : `in ${plural(due, "day")}`}</span>}
            <span className="spacer" />
            {canNudge && (
              <button className="btn btn-outline btn-sm" onClick={sendNudge} disabled={nudge.isPending || !!nudgedToday}>
                <Icon name="bell" size={16} />
                {nudgedToday ? "Nudged today" : "Nudge"}
              </button>
            )}
            <button
              className="btn btn-dark btn-sm"
              onClick={async () => {
                await ret.mutateAsync(loan.id);
                toast(perspective === "lender" ? `"${loan.book.title}" is back on your shelf` : `Marked "${loan.book.title}" as returned`);
              }}
              disabled={ret.isPending}
            >
              <Icon name="check" size={16} />
              {perspective === "lender" ? "It's back" : "I returned it"}
            </button>
          </div>
        )}
        {perspective === "lender" && loan.nudgeCount > 0 && (
          <p className="muted small">Nudged {plural(loan.nudgeCount, "time")}</p>
        )}
      </div>
    </article>
  );
}
