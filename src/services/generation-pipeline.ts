import { generateQuestionsWithWangchanNlp } from "./wangchan-nlp-service";
import { aiValidateQuestion } from "./ai-validator";
import { loadQuestions, appendQuestions, restoreFromBackup } from "@/lib/excel-db";
import { appendGenerationLog } from "@/lib/generation-log";
import { appendImportLog } from "@/lib/import-log";

let isSaving = false;

export function validateQuestion(q: any) {
  if (!q) return { valid: false, reason: "missing" };
  if (typeof q.question !== "string" || q.question.trim().length <= 10) return { valid: false, reason: "question too short" };
  const choices = [q.choice_a, q.choice_b, q.choice_c, q.choice_d];
  if (choices.some((c) => typeof c !== "string" || c.trim().length === 0)) return { valid: false, reason: "missing choices" };
  const correct = String(q.correct_answer || "").toUpperCase();
  if (!["A", "B", "C", "D"].includes(correct)) return { valid: false, reason: "invalid correct_answer" };
  return { valid: true };
}

async function saveWithRetry(rows: any[]) {
  if (isSaving) throw new Error("save already running");
  isSaving = true;
  try {
    const beforeCount = (await loadQuestions()).length;

    // First attempt
    const r1 = await appendQuestions(rows as any[]);
    const appended1 = (r1 && (r1 as any).appended) ? (r1 as any).appended : 0;
    const rejected1 = (r1 && (r1 as any).rejected) ? (r1 as any).rejected : [];
    const afterCount1 = (await loadQuestions()).length;

    if (afterCount1 === beforeCount + appended1) {
      // successful
      // if some rows were rejected, include that in logs by throwing to caller if needed
      return { saved: appended1, before: beforeCount, after: afterCount1, rejected: rejected1 };
    }

    // Attempt rollback from primary backup, then retry once
    try {
      await restoreFromBackup((process.cwd() + "/" + (process.env.DATA_DIR || "data") + "/questions.xlsx"));
    } catch (_) {}

    // Retry append

    const r2 = await appendQuestions(rows as any[]);
    const appended2 = (r2 && (r2 as any).appended) ? (r2 as any).appended : 0;
    const rejected2 = (r2 && (r2 as any).rejected) ? (r2 as any).rejected : [];
    const afterCount2 = (await loadQuestions()).length;

    if (afterCount2 === beforeCount + appended2) {
      return { saved: appended2, before: beforeCount, after: afterCount2, rejected: rejected2 };
    }

    // Final failure: log and throw
    await appendImportLog({ import_time: new Date().toISOString(), questions_generated: rows.length, questions_saved: 0, database_total_before: beforeCount, database_total_after: afterCount2, reason: "verification mismatch after retry", rejected: (rejected2 || []).length });
    throw new Error("Question generation failed to persist to database after retry.");
  } finally {
    isSaving = false;
  }
}

export async function generateAndSave(payload: { category: string; subcategory: string; count: number; difficulty: string }) {
  // Generate
  const generated = await generateQuestionsWithWangchanNlp({ category: payload.category as any, subcategory: payload.subcategory as any, count: payload.count, difficulty: payload.difficulty as any });

  // Validate strictly
  const valid: any[] = [];
  const rejected: any[] = [];
  for (const g of generated) {
    const check = validateQuestion(g);
    if (!check.valid) {
      rejected.push({ row: g, reason: check.reason });
      continue;
    }

    // Additional AI classifier check (best-effort)
    try {
      const ok = await aiValidateQuestion({ question: g.question, choices: [g.choice_a, g.choice_b, g.choice_c, g.choice_d], correct: g.correct_answer });
      if (!ok.valid) {
        rejected.push({ row: g, reason: JSON.stringify(ok.reasons) });
        continue;
      }
    } catch (e) {
      // classifier failure -> reject to be safe
      rejected.push({ row: g, reason: "ai-validation-failed" });
      continue;
    }

    valid.push(g);
  }

  // Save valid rows using transactional retry
  const genTimestamp = new Date().toISOString();
  let saved = 0;
  let before = 0;
  let after = 0;
  if (valid.length > 0) {
    const res = await saveWithRetry(valid);
    saved = res.saved;
    before = res.before;
    after = res.after;
  } else {
    before = (await loadQuestions()).length;
    after = before;
  }

  // Append generation log (xlsx)
  try {
    await appendGenerationLog({ timestamp: genTimestamp, generated: generated.length, valid: valid.length, saved: saved, failed: rejected.length });
  } catch (e) {
    // non-fatal
  }

  // Append import log (existing JSON log for imports)
  await appendImportLog({ import_time: genTimestamp, questions_generated: generated.length, questions_saved: saved, database_total_before: before, database_total_after: after, rejected_questions: rejected.length });

  // Refresh client UI responsibility: route handler should call router.refresh() client-side.

  return { generated: generated.length, valid: valid.length, saved, rejected: rejected.length, totalBefore: before, totalAfter: after };
}

export async function refreshQuestionList() {
  const { refreshQuestionList: refresh } = await import("./question-service");
  return await refresh();
}
