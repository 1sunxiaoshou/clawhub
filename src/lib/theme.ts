import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

const THEME_KEY = "clawhub-theme";
const LEGACY_THEME_KEY = "clawdhub-theme";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  const legacy = window.localStorage.getItem(LEGACY_THEME_KEY);
  if (legacy === "light" || legacy === "dark") return legacy;
  return "light";
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = mode;
  document.documentElement.classList.toggle("dark", mode === "dark");
}

export function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setMode(getStoredTheme());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    applyTheme(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_KEY, mode);
    }
  }, [isHydrated, mode]);

  return { mode, setMode };
}
