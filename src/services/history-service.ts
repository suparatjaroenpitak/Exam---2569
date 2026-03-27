import { appendHistory, loadHistory } from "@/lib/prisma-db";
import { normalizeSubject } from "@/lib/constants";
import type { DashboardStats, ExamResultRow } from "@/lib/types";

function createHistoryId() {
  return `result_${crypto.randomUUID()}`;
}

export async function recordExamHistory(row: Omit<ExamResultRow, "id" | "createdAt">) {
  const prepared: ExamResultRow = {
    ...row,
    id: createHistoryId(),
    createdAt: new Date().toISOString()
  };

  await appendHistory([prepared]);
  return prepared;
}

export async function getHistoryForUser(userId: string) {
  const history = await loadHistory();
  return history
    .flatMap((entry) => {
      const subject = normalizeSubject(entry.subject || entry.category || "");

      if (!subject) {
        return [];
      }

      return [
        {
          ...entry,
          subject,
          category: subject,
          subcategory: entry.subcategory || "all"
        }
      ];
    })
    .filter((entry) => entry.userId === userId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const history = await getHistoryForUser(userId);

  if (history.length === 0) {
    return {
      totalAttempts: 0,
      bestScore: 0,
      averageScore: 0
    };
  }

  const totalScore = history.reduce((sum, item) => sum + Number(item.score), 0);

  return {
    totalAttempts: history.length,
    bestScore: Math.max(...history.map((item) => Number(item.score))),
    averageScore: Math.round(totalScore / history.length)
  };
}
