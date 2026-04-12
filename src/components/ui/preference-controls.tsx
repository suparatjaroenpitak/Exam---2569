"use client";

import { usePreferences } from "@/components/preferences-provider";

export function PreferenceControls() {
  const { locale, theme, setLocale, setTheme, translate } = usePreferences();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="theme-card-soft flex items-center gap-2 rounded-full px-3 py-2 text-sm">
        <span className="text-xs text-white/68">{translate("toggle.language")}</span>
        <button
          type="button"
          onClick={() => setLocale("th")}
          className={`rounded-full px-3 py-1 font-medium transition ${
            locale === "th"
              ? "theme-button-primary text-xs font-semibold"
              : "theme-button-secondary text-xs font-semibold"
          }`}
        >
          TH
        </button>
        <button
          type="button"
          onClick={() => setLocale("en")}
          className={`rounded-full px-3 py-1 font-medium transition ${
            locale === "en"
              ? "theme-button-primary text-xs font-semibold"
              : "theme-button-secondary text-xs font-semibold"
          }`}
        >
          EN
        </button>
      </div>

      <div className="theme-card-soft flex items-center gap-2 rounded-full px-3 py-2 text-sm">
        <span className="text-xs text-white/68">{translate("toggle.theme")}</span>
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={`rounded-full px-3 py-1 font-medium transition ${
            theme === "light"
              ? "theme-button-primary text-xs font-semibold"
              : "theme-button-secondary text-xs font-semibold"
          }`}
        >
          {translate("theme.light")}
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={`rounded-full px-3 py-1 font-medium transition ${
            theme === "dark"
              ? "theme-button-primary text-xs font-semibold"
              : "theme-button-secondary text-xs font-semibold"
          }`}
        >
          {translate("theme.dark")}
        </button>
      </div>
    </div>
  );
}
