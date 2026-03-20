"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { apiRequest } from "@/api/client";
import { usePreferences } from "@/components/preferences-provider";
import { DIFFICULTY_OPTIONS, EXAM_CATEGORIES, SUBJECT_SUBCATEGORIES } from "@/lib/constants";
import { getCategoryLabel, getDifficultyLabel, getSubcategoryLabel, translateApiMessage } from "@/i18n";
import type { ExamCategory, ExamSubcategory, QuestionDifficulty } from "@/lib/types";

type GenerationJobResponse = {
  id: string;
  state: "queued" | "running" | "completed" | "failed";
  progress: number;
  stage: string;
  message: string;
  result?: {
    message?: string;
    saved?: number;
    requested?: number;
    completionPercent?: number;
  };
  error?: string;
};

function translateStage(locale: string, stage: string, fallback: string) {
  if (locale !== "th") {
    return fallback;
  }

  switch (stage) {
    case "queued":
      return "กำลังเข้าคิวงาน...";
    case "preparing":
      return "กำลังเตรียมข้อมูล...";
    case "generating":
      return "กำลังสร้างข้อสอบจาก AI...";
    case "validating":
      return "กำลังตรวจรูปแบบ หัวข้อ และความซ้ำ...";
    case "top-up":
      return "กำลังสร้างข้อสอบเพิ่มให้ครบจำนวน...";
    case "saving":
      return "กำลังบันทึกข้อสอบลงฐานข้อมูล...";
    case "refreshing":
      return "กำลังรีเฟรชรายการข้อสอบ...";
    case "completed":
      return fallback;
    case "failed":
      return fallback;
    default:
      return fallback;
  }
}

export function NlpGeneratorForm() {
  const router = useRouter();
  const { locale, translate } = usePreferences();
  const [category, setCategory] = useState<ExamCategory>(EXAM_CATEGORIES[0]);
  const [subcategory, setSubcategory] = useState<ExamSubcategory>(SUBJECT_SUBCATEGORIES[EXAM_CATEGORIES[0]][0]);
  const [count, setCount] = useState(20);
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(DIFFICULTY_OPTIONS[1]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [progressDetail, setProgressDetail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);
    setProgress(4);
    setProgressLabel(locale === "th" ? "กำลังส่งงานไปที่เซิร์ฟเวอร์..." : "Submitting generation job...");
    setProgressDetail(null);

    const requestedCount = count;

    try {
      const startResponse = await apiRequest<{ jobId: string }>("/api/admin/generate-questions", {
        method: "POST",
        body: JSON.stringify({ category, subcategory, count, difficulty })
      });

      setProgress(6);
      setProgressLabel(locale === "th" ? "เริ่มประมวลผลแล้ว" : "Job started");

      let final: GenerationJobResponse | null = null;
      while (!final) {
        await new Promise((res) => setTimeout(res, 700));
        const job = await apiRequest<GenerationJobResponse>(`/api/admin/generate-questions?jobId=${encodeURIComponent(startResponse.jobId)}`);
        setProgress(Math.max(6, Math.min(job.progress ?? 0, 100)));
        setProgressLabel(translateStage(locale, job.stage, job.message));
        setProgressDetail(job.message);

        if (job.state === "failed") {
          throw new Error(job.error || job.message || translate("message.generation-failed"));
        }

        if (job.state === "completed") {
          final = job;
        }
      }

      if (final?.result) {
        const completionPercent = typeof final.result.completionPercent === "number"
          ? final.result.completionPercent
          : Math.round(((final.result.saved ?? 0) / Math.max(requestedCount, 1)) * 100);
        setProgress(completionPercent);
        setProgressLabel(locale === "th" ? `สำเร็จ ${completionPercent}%` : `${completionPercent}% complete`);
        setProgressDetail(final.message);
        setMessage(`${translateApiMessage(locale, final.result.message || final.message)} (${final.result.saved ?? 0}/${requestedCount}, ${completionPercent}%)`);
      }
      router.refresh();
    } catch (requestError) {
      setProgress(0);
      setProgressLabel(null);
      setProgressDetail(null);
      setError(requestError instanceof Error ? requestError.message : translate("message.generation-failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{translate("admin.nlp-generator")}</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950 dark:text-slate-100">{translate("admin.create-nlp")}</h3>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("dashboard.category")}</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={category}
              onChange={(event) => {
                const nextCategory = event.target.value as ExamCategory;
                setCategory(nextCategory);
                setSubcategory(SUBJECT_SUBCATEGORIES[nextCategory][0]);
              }}
            >
              {EXAM_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {getCategoryLabel(locale, item)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("admin.subcategory")}</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={subcategory}
              onChange={(event) => setSubcategory(event.target.value as ExamSubcategory)}
            >
              {SUBJECT_SUBCATEGORIES[category].map((item) => (
                <option key={item} value={item}>
                  {getSubcategoryLabel(locale, item)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{translate("dashboard.questions")}</span>
            <input
              min={1}
              max={100}
              type="number"
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
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
        {progress > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
              <span>{progressLabel ?? translate("admin.generating")}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-ember transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {progressDetail ? <p className="text-xs text-slate-500 dark:text-slate-400">{progressDetail}</p> : null}
          </div>
        ) : null}
        {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-ember px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sand disabled:opacity-60"
        >
          {loading ? translate("admin.generating") : translate("admin.generate")}
        </button>
      </form>
    </section>
  );
}
