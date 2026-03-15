"use client";

import { type FormEvent, useState } from "react";

import { usePreferences } from "@/components/preferences-provider";
import { DIFFICULTY_OPTIONS, EXAM_CATEGORIES } from "@/lib/constants";
import { getCategoryLabel, getDifficultyLabel, translateApiMessage } from "@/i18n";
import type { ExamCategory, QuestionDifficulty } from "@/lib/types";

export function PdfImportForm() {
  const { locale, translate } = usePreferences();
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<ExamCategory>(EXAM_CATEGORIES[0]);
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(DIFFICULTY_OPTIONS[1]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!file) {
      setError(translate("message.pdf-select-file"));
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      formData.append("difficulty", difficulty);

      const response = await fetch("/api/admin/import-pdf", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(translateApiMessage(locale, payload.message || "Import failed"));
      }

      setMessage(translateApiMessage(locale, payload.message || "PDF imported successfully"));
      setFile(null);
      event.currentTarget.reset();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : translate("message.import-failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{translate("admin.pdf-import")}</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950 dark:text-slate-100">{translate("admin.upload-pdf")}</h3>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <input
          required
          type="file"
          accept="application/pdf"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("dashboard.category")}</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={category}
              onChange={(event) => setCategory(event.target.value as ExamCategory)}
            >
              {EXAM_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {getCategoryLabel(locale, item)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("admin.difficulty")}</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as QuestionDifficulty)}
            >
              {DIFFICULTY_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {getDifficultyLabel(locale, item)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent disabled:opacity-60 dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200"
        >
          {loading ? translate("admin.importing") : translate("admin.import")}
        </button>
      </form>
    </section>
  );
}
