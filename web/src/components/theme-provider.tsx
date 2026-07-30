import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

export const THEME_STORAGE_KEY = "tradermemos-ui-theme";

const initialState: ThemeProviderState = {
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(storageKey: string, fallback: Theme): Theme {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(storageKey);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return fallback;
}

/**
 * Normalize a computed color to #rrggbb — Safari won't take `color(srgb …)` as
 * a theme-color, and that is what a `color-mix()` token computes to.
 */
function toHexColor(value: string): string | null {
  const parts = value.match(/-?[\d.]+(?:e[-+]?\d+)?/gi);
  if (!parts || parts.length < 3) return null;
  // `color(srgb 0.087 0.087 0.087)` gives 0–1 fractions; `rgb(22, 22, 22)` gives 0–255.
  const scale = value.startsWith("color(") ? 255 : 1;
  if (parts.length > 3 && Number(parts[3]) === 0) return null; // fully transparent
  const channel = (raw: string) => {
    const n = Math.round(Number(raw) * scale);
    return Math.min(255, Math.max(0, n)).toString(16).padStart(2, "0");
  };
  return `#${channel(parts[0])}${channel(parts[1])}${channel(parts[2])}`;
}

function applyThemeClass(resolved: ResolvedTheme) {
  const root = window.document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;

  // Read --background back off the body (the class swap above already applied)
  // so the browser-chrome tint can't drift from the token. The stored theme
  // outranks the system scheme, so every media-scoped copy in index.html gets
  // the same value — whichever one matches is then correct.
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (metas.length === 0) return;
  const bg = document.body ? getComputedStyle(document.body).backgroundColor : null;
  const chrome = (bg && toHexColor(bg)) ?? (resolved === "dark" ? "#161616" : "#ffffff");
  for (const meta of metas) {
    meta.setAttribute("content", chrome);
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme(storageKey, defaultTheme));
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const stored = readStoredTheme(storageKey, defaultTheme);
    return stored === "system" ? getSystemTheme() : stored;
  });

  const resolve = useCallback((next: Theme): ResolvedTheme => {
    return next === "system" ? getSystemTheme() : next;
  }, []);

  useLayoutEffect(() => {
    const resolved = resolve(theme);
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, [theme, resolve]);

  useEffect(() => {
    if (theme !== "system") return;
    if (typeof window.matchMedia !== "function") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      applyThemeClass(resolved);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback(
    (next: Theme) => {
      window.localStorage.setItem(storageKey, next);
      setThemeState(next);
    },
    [storageKey],
  );

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
