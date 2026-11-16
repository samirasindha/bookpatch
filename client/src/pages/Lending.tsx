import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { CheckoutCard } from "../features/lending/CheckoutCard";
import { useLoans } from "../lib/hooks";

type Tab = "lent" | "borrowed" | "history";

export function LendingPage() {
  const loans = useLoans();
  const [tab, setTab] = useState<Tab>("lent");
  const data = loans.data;

  const list = data?.[tab] ?? [];
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "lent", label: "Lent out", count: data?.lent.length },
    { id: "borrowed", label: "Borrowed", count: data?.borrowed.length },
    { id: "history", label: "Returned" },
  ];

  return (
    <>
      <h1 className="page-title">
        Who has your books.
        <br />
        <em>And whose books you have.</em>
      </h1>

      <div className="chips" role="tablist" aria-label="Loans" style={{ margin: "2rem 0 1.75rem" }}>
        {tabs.map((t) => (
          <button key={t.id} role="tab" className="chip" aria-selected={tab === t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label} {t.count !== undefined && <span className="count">{t.count}</span>}
          </button>
        ))}
      </div>

      {loans.isLoading ? (
        <div className="checkout-list" aria-busy="true">
          <div className="skeleton" style={{ height: 180 }} />
          <div className="skeleton" style={{ height: 180 }} />
        </div>
      ) : list.length === 0 ? (
        <div className="empty">
          <Icon name="lend" size={40} />
          <p className="section-title" style={{ color: "var(--text)" }}>
            {tab === "lent" ? "Every book is home" : tab === "borrowed" ? "You're not borrowing anything" : "No returns yet"}
          </p>
          {tab === "lent" && (
            <p>
              To lend a book, open it from <Link to="/library">your library</Link> and choose "Lend this book."
            </p>
          )}
        </div>
      ) : (
        <div className="checkout-list" role="tabpanel">
          {list.map((l) => (
            <CheckoutCard key={l.id} loan={l} perspective={tab === "lent" ? "lender" : tab === "borrowed" ? "borrower" : "history"} />
          ))}
        </div>
      )}
    </>
  );
}
