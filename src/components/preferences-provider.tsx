"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { type Locale, type ThemeMode, t } from "@/i18n";

type PreferencesContextValue = {
  locale: Locale;
  theme: ThemeMode;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemeMode) => void;
  translate: (key: string, defaultText?: string) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const LOCALE_KEY = "exam-app-locale";
const THEME_KEY = "exam-app-theme";

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function applyLocale(locale: Locale) {
  document.documentElement.lang = locale === "th" ? "th" : "en";
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("th");
  const [theme, setThemeState] = useState<ThemeMode>("light");

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(LOCALE_KEY);
    const storedTheme = window.localStorage.getItem(THEME_KEY);

    const nextLocale = storedLocale === "en" || storedLocale === "th" ? storedLocale : "th";
    const nextTheme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : "light";

    setLocaleState(nextLocale);
    setThemeState(nextTheme);
    applyLocale(nextLocale);
    applyTheme(nextTheme);
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      locale,
      theme,
      setLocale(nextLocale) {
        setLocaleState(nextLocale);
        window.localStorage.setItem(LOCALE_KEY, nextLocale);
        applyLocale(nextLocale);
      },
      setTheme(nextTheme) {
        setThemeState(nextTheme);
        window.localStorage.setItem(THEME_KEY, nextTheme);
        applyTheme(nextTheme);
      },
      translate(key, defaultText) {
        return t(locale, key, defaultText);
      }
    }),
    [locale, theme]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }

  return context;
}
