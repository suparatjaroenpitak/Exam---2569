import { aiValidateQuestion } from "./ai-validator";
import { isDuplicate, topicMatches, computeQualityScore, validateShape } from "@/services/ai-validation-service";
import { generateWithPythonEngine } from "@/services/python-ai-service";
import { loadQuestions, appendQuestions, restoreFromBackup, saveQuestions } from "@/lib/excel-db";
import { appendGenerationLog } from "@/lib/generation-log";
import { appendImportLog } from "@/lib/import-log";

let isSaving = false;

type ProgressReporter = (update: { progress: number; stage: string; message: string }) => void | Promise<void>;

export function validateQuestion(q: any) {
  if (!q) return { valid: false, reason: "missing" };
  if (typeof q.question !== "string" || q.question.trim().length <= 15) return { valid: false, reason: "question too short" };
  const choicesArr = [q.choice_a, q.choice_b, q.choice_c, q.choice_d];
  const choicesCount = choicesArr.filter((c) => typeof c === "string" && c.trim().length > 0).length;
  if (choicesCount < 3) return { valid: false, reason: "not enough choices" };
  const correct = String(q.correct_answer || "").toUpperCase();
  const hasValidAnswer = ["A", "B", "C", "D"].includes(correct);
  return { valid: true, needsReview: !hasValidAnswer } as any;
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

async function purgeAiGeneratedQuestions() {
  const existing = await loadQuestions();
  const remaining = existing.filter((row) => String(row.source || "").toLowerCase() !== "ai");
  const removed = existing.length - remaining.length;
  if (removed > 0) {
    await saveQuestions(remaining as any[]);
  }
  return { removed, remaining: remaining.length };
}

export async function generateAndSave(payload: { category: string; subcategory: string; count: number; difficulty: string; onProgress?: ProgressReporter }) {
  const report = async (progress: number, stage: string, message: string) => {
    if (!payload.onProgress) return;
    await payload.onProgress({ progress, stage, message });
  };

  await report(8, "preparing", `Preparing ${payload.count} questions for ${payload.subcategory}`);
  // Generate with retries using the Transformers-backed Python engine only.
  const maxAttempts = 3;
  let generated: any[] = [];
  let lastGenerationError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await report(12 + (attempt - 1) * 8, "generating", `Generating draft questions${maxAttempts > 1 ? ` (attempt ${attempt}/${maxAttempts})` : ""}`);
    try {
      generated = await generateWithPythonEngine({
        category: payload.category,
        subcategory: payload.subcategory,
        count: payload.count,
        difficulty: payload.difficulty
      });
      lastGenerationError = null;
    } catch (error) {
      lastGenerationError = error instanceof Error ? error : new Error(String(error));
      generated = [];
    }

    if (Array.isArray(generated) && generated.length > 0) break;
    await new Promise((res) => setTimeout(res, 600));
  }
  if (!Array.isArray(generated) || generated.length === 0) {
    throw new Error(lastGenerationError?.message || "Transformers generator returned no questions. Check HUGGINGFACE_API_KEY and model configuration.");
  }

  await report(42, "validating", `Validating ${generated.length} generated questions`);

  // Validate strictly with duplicate detection, topic matching, and quality scoring
  const valid: any[] = [];
  const rejected: any[] = [];

  const existingQuestions = (await loadQuestions())
    .filter((row) => String(row.source || "").toLowerCase() !== "ai")
    .map((r) => String(r.question || ""));

  async function tryAcceptCandidate(g: any, allowReplacement = true): Promise<boolean> {
    const baseCheck: any = validateQuestion(g);
    if (!baseCheck.valid) {
      rejected.push({ row: g, reason: baseCheck.reason });
      return false;
    }

    try {
      const pyShape = await validateShape(g as any);
      if (pyShape === null || !pyShape.valid) {
        rejected.push({ row: g, reason: pyShape ? pyShape.reason : "python-validator-failed" });
        return false;
      }
    } catch (e) {
      // ignore python validator failures and continue
    }

    try {
      const matches = await topicMatches(String(payload.subcategory), `${g.question}\n${g.choice_a}\n${g.choice_b}\n${g.choice_c}\n${g.choice_d}`);
      if (!matches) {
        rejected.push({ row: g, reason: "topic-mismatch" });
        return false;
      }
    } catch (e) {
      rejected.push({ row: g, reason: "topic-check-failed" });
      return false;
    }

    try {
      const dupAgainstDB = await isDuplicate(g.question, existingQuestions, 0.85);
      const dupAgainstBatch = await isDuplicate(g.question, valid.map((v) => v.question || ""), 0.85);
      if (dupAgainstDB || dupAgainstBatch) {
        rejected.push({ row: g, reason: "duplicate" });
        return false;
      }
    } catch (e) {
      rejected.push({ row: g, reason: "duplicate-check-failed" });
      return false;
    }

    try {
      const qscore = computeQualityScore({ question: g.question, choice_a: g.choice_a, choice_b: g.choice_b, choice_c: g.choice_c, choice_d: g.choice_d, difficulty: payload.difficulty, topic: String(payload.subcategory) });
      (g as any).quality_score = qscore;
      if (qscore < 70) {
        rejected.push({ row: g, reason: `low-quality:${qscore}` });
        return false;
      }
    } catch (e) {
      (g as any).quality_score = 50;
    }

    let needsReview = Boolean(baseCheck.needsReview);
    try {
      const ok = await aiValidateQuestion({ question: g.question, choices: [g.choice_a, g.choice_b, g.choice_c, g.choice_d], correct: g.correct_answer });
      if (!ok.valid) {
        needsReview = true;
      }
    } catch (e) {
      needsReview = true;
    }

    (g as any).__needsReview = needsReview;
    valid.push(g);
    return true;
  }

  for (const [index, g] of generated.entries()) {
    await tryAcceptCandidate(g, true);
    const validationProgress = Math.round(42 + (((index + 1) / Math.max(generated.length, 1)) * 28));
    await report(validationProgress, "validating", `Validated ${index + 1}/${generated.length} generated questions`);
  }

  let fillAttempts = 0;
  const maxFillAttempts = Math.max(payload.count * 3, 12);
  while (valid.length < payload.count && fillAttempts < maxFillAttempts) {
    fillAttempts += 1;
    const remaining = payload.count - valid.length;
    const batchSize = Math.min(Math.max(remaining, 1), 5);
    await report(72, "top-up", `Generating ${batchSize} replacement question${batchSize > 1 ? "s" : ""} to reach ${payload.count}`);
    try {
      const replRows = await generateWithPythonEngine({ category: payload.category, subcategory: payload.subcategory, count: batchSize, difficulty: payload.difficulty });
      if (!Array.isArray(replRows) || replRows.length === 0) {
        continue;
      }
      for (const replRow of replRows) {
        if (valid.length >= payload.count) {
          break;
        }
        await tryAcceptCandidate(replRow, false);
      }
      const topUpProgress = Math.min(88, 72 + Math.round((valid.length / Math.max(payload.count, 1)) * 16));
      await report(topUpProgress, "top-up", `Accepted ${valid.length}/${payload.count} questions after top-up`);
    } catch (e) {
      // keep trying until cap
    }
  }

  // Save valid rows using transactional retry
  const genTimestamp = new Date().toISOString();
  let saved = 0;
  let before = 0;
  let after = 0;
  let clearedAi = 0;
  if (valid.length > 0) {
    await report(92, "saving", `Saving ${valid.length} validated questions`);
    const purge = await purgeAiGeneratedQuestions();
    clearedAi = purge.removed;
    const res = await saveWithRetry(valid);
    saved = res.saved;
    before = res.before;
    after = res.after;
  } else {
    before = (await loadQuestions()).length;
    after = before;
    throw new Error("Transformers generated questions but none passed validation.");
  }

  // Append generation log (xlsx)
  try {
    await appendGenerationLog({ timestamp: genTimestamp, generated: generated.length, valid: valid.length, saved: saved, failed: rejected.length, fallbackUsed: false });
  } catch (e) {
    // non-fatal
  }

  // Append import log (existing JSON log for imports)
  await appendImportLog({ import_time: genTimestamp, questions_generated: generated.length, questions_saved: saved, database_total_before: before, database_total_after: after, rejected_questions: rejected.length, cleared_ai_questions: clearedAi });

  // Invalidate the in-memory question cache so the next admin page refresh sees the new rows immediately.
  await report(98, "refreshing", "Refreshing question cache");
  await refreshQuestionList();

  await report(100, "completed", `Saved ${saved}/${payload.count} questions`);

  return {
    generated: generated.length,
    valid: valid.length,
    saved,
    rejected: rejected.length,
    totalBefore: before,
    totalAfter: after,
    clearedAi,
    requested: payload.count,
    completionPercent: Math.round((saved / Math.max(payload.count, 1)) * 100),
    fallbackUsed: false
  };
}

export async function refreshQuestionList() {
  const { refreshQuestionList: refresh } = await import("./question-service");
  return await refresh();
}
