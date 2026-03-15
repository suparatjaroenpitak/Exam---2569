"use client";

import { usePreferences } from "@/components/preferences-provider";
import { getCategoryLabel } from "@/i18n";
import { formatDateTime } from "@/utils/format";
import type { ExamResultRow } from "@/lib/types";

export function HistoryTable({ history }: { history: ExamResultRow[] }) {
  const { locale, translate } = usePreferences();

  return (
    <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{translate("history.eyebrow")}</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950 dark:text-slate-100">{translate("history.title")}</h3>
      </div>
      {history.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">{translate("history.empty")}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">{translate("history.date")}</th>
                <th className="px-4 py-3 font-medium">{translate("history.category")}</th>
                <th className="px-4 py-3 font-medium">{translate("history.score")}</th>
                <th className="px-4 py-3 font-medium">{translate("history.correct")}</th>
                <th className="px-4 py-3 font-medium">{translate("history.duration")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950/60">
              {history.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(item.createdAt, locale)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{getCategoryLabel(locale, item.subject)}</td>
                  <td className="px-4 py-3 font-semibold text-accent">{item.score}%</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {item.correctCount}/{item.totalQuestions}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{Math.ceil(Number(item.durationSeconds) / 60)} {translate("history.min")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
