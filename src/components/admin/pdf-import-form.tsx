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
    <section className="theme-card rounded-[2rem] p-6">
      <div className="mb-6">
        <p className="theme-kicker text-xs font-semibold">{translate("admin.pdf-import")}</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">{translate("admin.upload-pdf")}</h3>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <input
          required
          type="file"
          accept="application/pdf"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          className="theme-input block w-full rounded-2xl px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[#2148c0] hover:file:bg-[#edf3ff]"
        />
        <label className="theme-card-soft flex items-start gap-3 rounded-2xl px-4 py-3 text-sm text-white/80">
          <input
            type="checkbox"
            checked={useThaiNlpParser}
            onChange={(event) => setUseThaiNlpParser(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent accent-white"
          />
          <span>
            <span className="block font-medium text-white">{translate("admin.pdf-import-wangchan")}</span>
            <span className="block text-white/60">{translate("admin.pdf-import-wangchan-help")}</span>
          </span>
        </label>
        <p className="text-sm text-white/72">{translate("admin.import-auto-detect")}</p>
        {message ? <p className="theme-message-success rounded-2xl px-4 py-3 text-sm">{message}</p> : null}
        {error ? <p className="theme-message-error rounded-2xl px-4 py-3 text-sm">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="theme-button-primary rounded-2xl px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em]"
        >
          {loading ? translate("admin.importing") : translate("admin.import")}
        </button>
      </form>
    </section>
  );
}
