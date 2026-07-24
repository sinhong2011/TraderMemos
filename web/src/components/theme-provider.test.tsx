import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ThemeProvider, THEME_STORAGE_KEY, useTheme, type Theme } from "./theme-provider";

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>;
}

function mockMatchMedia(matchesDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("dark") ? matchesDark : !matchesDark,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.classList.remove("light", "dark");
    mockMatchMedia(true);
  });

  afterEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.classList.remove("light", "dark");
  });

  it("defaults to dark and persists preference", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("dark");
    expect(result.current.resolvedTheme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      result.current.setTheme("light");
    });

    expect(result.current.theme).toBe("light");
    expect(result.current.resolvedTheme).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("accepts system theme", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => {
      result.current.setTheme("system" satisfies Theme);
    });
    expect(result.current.theme).toBe("system");
    expect(result.current.resolvedTheme).toBe("dark");
  });
});
