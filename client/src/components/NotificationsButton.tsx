import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { Sheet } from "./Sheet";
import { useMarkAllRead, useNotifications } from "../lib/hooks";
import { shortDate, timeAgo } from "../lib/dates";
import type { Notification } from "../lib/types";

function describe(n: Notification) {
  const who = n.payload.from ?? n.payload.by;
  const name = who?.name ?? "Someone";
  switch (n.type) {
    case "new_follower":
      return { who, text: <><strong>{name}</strong> started following you</>, link: who ? `/u/${who.handle}` : undefined };
    case "loan_created":
      return {
        who,
        text: <><strong>{name}</strong> lent you <em>{n.payload.title}</em>{n.payload.dueDate ? `, due ${shortDate(n.payload.dueDate)}` : ""}</>,
        link: "/lending",
      };
    case "nudge":
      return { who, text: <><strong>{name}</strong> sent a friendly nudge about <em>{n.payload.title}</em></>, link: "/lending" };
    case "loan_returned":
      return { who, text: <><strong>{name}</strong> marked <em>{n.payload.title}</em> as returned</>, link: "/lending" };
  }
}

export function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const notes = useNotifications();
  const markRead = useMarkAllRead();
  const unread = notes.data?.unread ?? 0;

  return (
    <>
      <button
        className="icon-btn badge-host"
        aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
        onClick={() => {
          setOpen(true);
          if (unread) markRead.mutate();
        }}
      >
        <Icon name="bell" />
        {unread > 0 && <span className="badge" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Notifications">
        {notes.data?.items.length ? (
          <ul className="notif-list">
            {notes.data.items.map((n) => {
              const d = describe(n);
              const body = (
                <>
                  {d.who ? <Avatar user={d.who} size={36} /> : <Icon name="bell" />}
                  <span className="stack" style={{ gap: "0.1rem" }}>
                    <span>{d.text}</span>
                    <span className="muted small">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="dot" aria-label="New" />}
                </>
              );
              return (
                <li key={n.id}>
                  {d.link ? (
                    <Link to={d.link} className="notif" onClick={() => setOpen(false)}>
                      {body}
                    </Link>
                  ) : (
                    <div className="notif">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">Nothing new. Notes from friends and lending reminders show up here.</p>
        )}
      </Sheet>
    </>
  );
}
