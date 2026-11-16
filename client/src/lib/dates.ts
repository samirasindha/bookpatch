const DAY = 86_400_000;

/** Dates like "2026-11-29" are calendar days, so read them at local noon to avoid timezone shifts. */
export const parseDay = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00` : d);

export function shortDate(d: string, withYear = false) {
  return parseDay(d).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
}

export function daysSince(d: string) {
  return Math.max(0, Math.floor((Date.now() - parseDay(d).getTime()) / DAY));
}

/** Whole days until a calendar date (negative when it's past). */
export function daysUntil(day: string) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((parseDay(day).getTime() - today.getTime()) / DAY);
}

export function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < DAY / 1000) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  return days < 30 ? `${days}d ago` : shortDate(d);
}

export function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
