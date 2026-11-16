import { useEffect, useRef } from "react";

/** Keystrokes closer together than this are a machine typing, not a person. */
const MAX_GAP_MS = 45;

export function looksLikeIsbn(s: string) {
  const v = s.replace(/[-\s]/g, "").toUpperCase();
  return /^(97[89])\d{10}$/.test(v) || /^\d{9}[\dX]$/.test(v);
}

/**
 * Handheld barcode scanners (USB or Bluetooth) act like a keyboard: they "type" the
 * barcode very fast and press Enter. This listens for that pattern anywhere in the app
 * (but not while the person is typing in a field) and hands back the ISBN.
 */
export function useHandheldScanner(onScan: (isbn: string) => void, enabled = true) {
  const buffer = useRef("");
  const last = useRef(0);
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;

      const now = performance.now();
      if (now - last.current > MAX_GAP_MS * 3) buffer.current = ""; // too slow: a human, start over
      last.current = now;

      if (e.key === "Enter") {
        const code = buffer.current;
        buffer.current = "";
        if (looksLikeIsbn(code)) {
          e.preventDefault();
          cb.current(code);
        }
      } else if (e.key.length === 1) {
        buffer.current += e.key;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
