import { Resend } from "resend";
import { env } from "../env.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/** Escapes text before it goes into an email's HTML, so names and titles can't inject markup. */
export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Sends an email if Resend is configured. Returns whether it was actually sent. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!resend) {
    console.info(`[email] RESEND_API_KEY not set; would send "${subject}" to ${to}`);
    return false;
  }
  try {
    const { error } = await resend.emails.send({ from: env.EMAIL_FROM, to, subject, html });
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    console.error("[email] send failed:", (err as Error).message);
    return false;
  }
}

export function nudgeEmail(opts: { lenderName: string; borrowerName: string; title: string; author: string | null; loanedAt: Date; dueDate: string | null }) {
  const e = escapeHtml;
  const loaned = opts.loanedAt.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const due = opts.dueDate
    ? `<p style="margin:0 0 16px;color:#5c5c5c">It was due back on ${e(new Date(opts.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" }))}.</p>`
    : "";
  return `
  <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#141414">
    <p style="font-style:italic;font-size:26px;margin:0 0 24px">bookpatch</p>
    <p style="font-size:17px;line-height:1.6;margin:0 0 16px">Hi ${e(opts.borrowerName)},</p>
    <p style="font-size:17px;line-height:1.6;margin:0 0 16px">
      ${e(opts.lenderName)} lent you <strong>${e(opts.title)}</strong>${opts.author ? ` by ${e(opts.author)}` : ""} on ${e(loaned)},
      and is sending a friendly reminder. Whenever you're finished, they'd love it back.
    </p>
    ${due}
    <p style="font-size:17px;line-height:1.6;margin:0 0 28px">No rush. Just checking in.</p>
    <p style="font-family:Arial,sans-serif;font-size:12px;color:#767676;border-top:1px solid #e6e6e6;padding-top:12px;margin:0">
      Sent with bookpatch, a little library for the books on your shelf.
    </p>
  </div>`;
}
