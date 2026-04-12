"use client";

import { usePreferences } from "@/components/preferences-provider";
import { getCategoryLabel } from "@/i18n";
import { formatDateTime } from "@/utils/format";
import type { ExamResultRow } from "@/lib/types";

export function HistoryTable({ history }: { history: ExamResultRow[] }) {
  const { locale, translate } = usePreferences();

  return (
    <section className="theme-card rounded-[2rem] p-6">
      <div className="mb-6">
        <p className="theme-kicker text-xs font-semibold">{translate("history.eyebrow")}</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">{translate("history.title")}</h3>
      </div>
      {history.length === 0 ? (
        <p className="theme-card-soft rounded-2xl px-4 py-5 text-sm text-white/72">{translate("history.empty")}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.05]">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.08] text-left text-white/60">
              <tr>
                <th className="px-4 py-3 font-medium">{translate("history.date")}</th>
                <th className="px-4 py-3 font-medium">{translate("history.category")}</th>
                <th className="px-4 py-3 font-medium">{translate("history.score")}</th>
                <th className="px-4 py-3 font-medium">{translate("history.correct")}</th>
                <th className="px-4 py-3 font-medium">{translate("history.duration")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {history.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-white/72">{formatDateTime(item.createdAt, locale)}</td>
                  <td className="px-4 py-3 font-medium text-white">{getCategoryLabel(locale, item.subject)}</td>
                  <td className="px-4 py-3 font-semibold text-[#dbe6ff]">{item.score}%</td>
                  <td className="px-4 py-3 text-white/72">
                    {item.correctCount}/{item.totalQuestions}
                  </td>
                  <td className="px-4 py-3 text-white/72">{Math.ceil(Number(item.durationSeconds) / 60)} {translate("history.min")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
