import { useContext } from "react";
import { ThemeProviderContext } from "@/components/ThemeProvider";

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  const toggleTheme = () => {
    const current = context.theme;
    if (current === "light") {
      context.setTheme("dark");
    } else if (current === "dark") {
      context.setTheme("light");
    } else {
      const systemIsDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      context.setTheme(systemIsDark ? "light" : "dark");
    }
  };

  return {
    theme: context.theme,
    setTheme: context.setTheme,
    toggleTheme,
  };
}
