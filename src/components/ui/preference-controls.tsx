"use client";

import { usePreferences } from "@/components/preferences-provider";

export function PreferenceControls() {
  const { locale, theme, setLocale, setTheme, translate } = usePreferences();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/70">
        <span className="text-slate-500 dark:text-slate-300">{translate("toggle.language")}</span>
        <button
          type="button"
          onClick={() => setLocale("th")}
          className={`rounded-full px-3 py-1 font-medium transition ${
            locale === "th"
              ? "bg-slate-950 text-white dark:bg-amber-300 dark:text-slate-950"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          TH
        </button>
        <button
          type="button"
          onClick={() => setLocale("en")}
          className={`rounded-full px-3 py-1 font-medium transition ${
            locale === "en"
              ? "bg-slate-950 text-white dark:bg-amber-300 dark:text-slate-950"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          EN
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/70">
        <span className="text-slate-500 dark:text-slate-300">{translate("toggle.theme")}</span>
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={`rounded-full px-3 py-1 font-medium transition ${
            theme === "light"
              ? "bg-amber-100 text-amber-950"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          {translate("theme.light")}
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={`rounded-full px-3 py-1 font-medium transition ${
            theme === "dark"
              ? "bg-slate-950 text-white dark:bg-slate-700"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          {translate("theme.dark")}
        </button>
      </div>
    </div>
  );
}
