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

function translateGenerationError(locale: string, message: string) {
  if (locale !== "th") {
    return message;
  }

  if (message.includes("Production AI configuration is invalid")) {
    return "Production ยังไม่พร้อมใช้งาน Python AI engine ตาม config ปัจจุบัน กรุณา redeploy Render ด้วย Docker setup ล่าสุด หรือกำหนด PYTHON_EXEC และ ALLOW_PYTHON_CLI_FALLBACK=1 ให้ service หลักเพื่อให้เรียก ai_engine ภายใน container เดียว";
  }

  if (message.includes("Python AI HTTP request failed")) {
    return `เรียก Python AI engine ไม่สำเร็จ: ${message}`;
  }

  return message;
}

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
      setError(
        requestError instanceof Error
          ? translateGenerationError(locale, requestError.message)
          : translate("message.generation-failed")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="theme-card rounded-[2rem] p-6">
      <div className="mb-6">
        <p className="theme-kicker text-xs font-semibold">{translate("admin.nlp-generator")}</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">{translate("admin.create-nlp")}</h3>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white/72">{translate("dashboard.category")}</span>
            <select
              className="theme-input w-full appearance-none rounded-2xl px-4 py-3 text-sm"
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
            <span className="mb-2 block text-sm font-medium text-white/72">{translate("admin.subcategory")}</span>
            <select
              className="theme-input w-full appearance-none rounded-2xl px-4 py-3 text-sm"
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
            <span className="mb-2 block text-sm font-medium text-white/72">{translate("dashboard.questions")}</span>
            <input
              min={1}
              max={100}
              type="number"
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
              className="theme-input w-full rounded-2xl px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white/72">{translate("admin.difficulty")}</span>
            <select
              className="theme-input w-full appearance-none rounded-2xl px-4 py-3 text-sm"
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
            <div className="flex items-center justify-between text-sm text-white/80">
              <span>{progressLabel ?? translate("admin.generating")}</span>
              <span>{progress}%</span>
            </div>
            <div className="theme-progress-track h-3 overflow-hidden rounded-full">
              <div
                className="theme-progress-bar h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {progressDetail ? <p className="text-xs text-white/58">{progressDetail}</p> : null}
          </div>
        ) : null}
        {message ? <p className="theme-message-success rounded-2xl px-4 py-3 text-sm">{message}</p> : null}
        {error ? <p className="theme-message-error rounded-2xl px-4 py-3 text-sm">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="theme-button-primary rounded-2xl px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em]"
        >
          {loading ? translate("admin.generating") : translate("admin.generate")}
        </button>
      </form>
    </section>
  );
}
