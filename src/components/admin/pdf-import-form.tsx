"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { usePreferences } from "@/components/preferences-provider";
import { translateApiMessage } from "@/i18n";

export function PdfImportForm() {
  const router = useRouter();
  const { locale, translate } = usePreferences();
  const [file, setFile] = useState<File | null>(null);
  const [useThaiNlpParser, setUseThaiNlpParser] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
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
      formData.append("parser", useThaiNlpParser ? "thai-nlp" : "standard");

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
      form.reset();
      router.refresh();
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
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <input
            type="checkbox"
            checked={useThaiNlpParser}
            onChange={(event) => setUseThaiNlpParser(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
          />
          <span>
            <span className="block font-medium">{translate("admin.pdf-import-wangchan")}</span>
            <span className="block text-slate-500 dark:text-slate-400">{translate("admin.pdf-import-wangchan-help")}</span>
          </span>
        </label>
        <p className="text-sm text-slate-600 dark:text-slate-300">{translate("admin.import-auto-detect")}</p>
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
