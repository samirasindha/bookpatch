import { useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "system";

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && media().matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** Light, dark, or follow the device. Saved per browser; public/theme-init.js applies it before first paint. */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => {
    try {
      return (localStorage.getItem("theme") as ThemePref) || "system";
    } catch {
      return "system";
    }
  });

  useEffect(() => {
    apply(pref);
    try {
      localStorage.setItem("theme", pref);
    } catch {
      /* private mode: theme still applies for this visit */
    }
    if (pref !== "system") return;
    const m = media();
    const onChange = () => apply("system");
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, [pref]);

  return [pref, setPref] as const;
}
