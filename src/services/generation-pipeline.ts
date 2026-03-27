import { isDuplicate, topicMatches, computeQualityScore, validateShape } from "@/services/ai-validation-service";
import { generateWithPythonEngine } from "@/services/python-ai-service";
import { appendQuestions, buildQuestionHash, loadQuestions } from "@/lib/prisma-db";
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
    const r1 = await appendQuestions(rows as any[]);
    const appended1 = (r1 && (r1 as any).appended) ? (r1 as any).appended : 0;
    const rejected1 = (r1 && (r1 as any).rejected) ? (r1 as any).rejected : [];
    const afterCount1 = (await loadQuestions()).length;

    if (afterCount1 === beforeCount + appended1) {
      return { saved: appended1, before: beforeCount, after: afterCount1, rejected: rejected1 };
    }
    const r2 = await appendQuestions(rows as any[]);
    const appended2 = (r2 && (r2 as any).appended) ? (r2 as any).appended : 0;
    const rejected2 = (r2 && (r2 as any).rejected) ? (r2 as any).rejected : [];
    const afterCount2 = (await loadQuestions()).length;

    if (afterCount2 === beforeCount + appended2) {
      return { saved: appended2, before: beforeCount, after: afterCount2, rejected: rejected2 };
    }

    await appendImportLog({ import_time: new Date().toISOString(), questions_generated: rows.length, questions_saved: 0, database_total_before: beforeCount, database_total_after: afterCount2, reason: "verification mismatch after retry", rejected: (rejected2 || []).length });
    throw new Error("Question generation failed to persist to database after retry.");
  } finally {
    isSaving = false;
  }
}

export async function generateAndSave(payload: { category: string; subcategory: string; count: number; difficulty: string; onProgress?: ProgressReporter }) {
  const report = async (progress: number, stage: string, message: string) => {
    if (!payload.onProgress) return;
    await payload.onProgress({ progress, stage, message });
  };

  await report(8, "preparing", `Preparing ${payload.count} questions for ${payload.subcategory}`);
  const maxAttempts = 3;
  let generated: any[] = [];
  let lastGenerationError: Error | null = null;
  const existingRows = await loadQuestions();
  const cachedRows = existingRows.filter((row) => row.subject === payload.category && row.subcategory === payload.subcategory && row.difficulty === payload.difficulty);
  const requestedCount = Math.max(1, payload.count);

  if (cachedRows.length >= requestedCount) {
    await report(100, "completed", `Using ${requestedCount} cached questions for ${payload.subcategory}`);
    return {
      generated: 0,
      valid: requestedCount,
      saved: 0,
      rejected: 0,
      totalBefore: existingRows.length,
      totalAfter: existingRows.length,
      clearedAi: 0,
      requested: requestedCount,
      completionPercent: 100,
      fallbackUsed: false,
      cached: true
    };
  }

  const generationTarget = Math.max(1, requestedCount - cachedRows.length);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await report(12 + (attempt - 1) * 8, "generating", `Generating draft questions${maxAttempts > 1 ? ` (attempt ${attempt}/${maxAttempts})` : ""}`);
    try {
      generated = await generateWithPythonEngine({
        category: payload.category,
        subcategory: payload.subcategory,
        count: generationTarget,
        difficulty: payload.difficulty,
        offset: 0
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
    throw new Error(lastGenerationError?.message || "Python AI engine returned no questions.");
  }

  await report(42, "validating", `Validating ${generated.length} generated questions`);

  const valid: any[] = [];
  const rejected: any[] = [];

  const existingQuestions = existingRows.map((r) => String(r.question || ""));

  const exactExistingQuestionKeys = new Set(existingQuestions.map((question) => String(question || "").replace(/\s+/g, " ").trim().toLowerCase()));

  function normalizedQuestionKey(question: unknown) {
    return String(question || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  async function tryAcceptCandidate(g: any, options?: { finalFallback?: boolean }): Promise<boolean> {
    const finalFallback = Boolean(options?.finalFallback);
    const isFallbackCandidate = String(g?.generation_mode || g?.source || "").toLowerCase().includes("fallback");
    const baseCheck: any = validateQuestion(g);
    if (!baseCheck.valid) {
      rejected.push({ row: g, reason: baseCheck.reason });
      return false;
    }

    try {
      const pyShape = await validateShape({ ...g, topic: payload.subcategory } as any);
      if ((pyShape === null || !pyShape.valid) && !finalFallback) {
        rejected.push({ row: g, reason: pyShape ? pyShape.reason : "python-validator-failed" });
        return false;
      }
      if (typeof pyShape?.quality_score === "number") {
        (g as any).quality_score = pyShape.quality_score;
      }
    } catch (e) {
      // ignore validator fallback here and continue with local heuristics
    }

    let matches = false;
    try {
      matches = await topicMatches(String(payload.subcategory), `${g.question}\n${g.choice_a}\n${g.choice_b}\n${g.choice_c}\n${g.choice_d}`);
      if (!matches && !isFallbackCandidate && !finalFallback) {
        rejected.push({ row: g, reason: "topic-mismatch" });
        return false;
      }
    } catch (e) {
      if (!isFallbackCandidate && !finalFallback) {
        rejected.push({ row: g, reason: "topic-check-failed" });
        return false;
      }
    }

    let duplicate = false;
    try {
      const questionKey = normalizedQuestionKey(g.question);
      const exactDupAgainstDB = exactExistingQuestionKeys.has(questionKey);
      const exactDupAgainstBatch = valid.some((v) => normalizedQuestionKey(v.question) === questionKey);
      const dupAgainstDB = finalFallback ? exactDupAgainstDB : await isDuplicate(g.question, existingQuestions, 0.85);
      const dupAgainstBatch = finalFallback ? exactDupAgainstBatch : await isDuplicate(g.question, valid.map((v) => v.question || ""), 0.85);
      duplicate = dupAgainstDB || dupAgainstBatch;
      if (duplicate) {
        rejected.push({ row: g, reason: "duplicate" });
        return false;
      }
    } catch (e) {
      rejected.push({ row: g, reason: "duplicate-check-failed" });
      return false;
    }

    try {
      const qscore = typeof g.quality_score === "number"
        ? g.quality_score
        : computeQualityScore({ question: g.question, choice_a: g.choice_a, choice_b: g.choice_b, choice_c: g.choice_c, choice_d: g.choice_d, difficulty: payload.difficulty, topic: String(payload.subcategory) });
      (g as any).quality_score = qscore;
      const minimumQuality = finalFallback ? 55 : isFallbackCandidate ? 65 : 70;
      if (qscore < minimumQuality) {
        rejected.push({ row: g, reason: `low-quality:${qscore}` });
        return false;
      }
    } catch (e) {
      (g as any).quality_score = 50;
    }

    const prepared = {
      id: crypto.randomUUID(),
      subject: payload.category,
      category: payload.category,
      subcategory: payload.subcategory,
      difficulty: payload.difficulty,
      question: String(g.question || "").trim(),
      choice_a: String(g.choice_a || "").trim(),
      choice_b: String(g.choice_b || "").trim(),
      choice_c: String(g.choice_c || "").trim(),
      choice_d: String(g.choice_d || "").trim(),
      correct_answer: String(g.correct_answer || "A").toUpperCase(),
      explanation: String(g.explanation || "").trim(),
      source: "python" as const,
      createdAt: new Date().toISOString(),
      model_subcategory: matches ? payload.subcategory : undefined,
      status: baseCheck.needsReview ? "REVIEW_REQUIRED" as const : "VALID" as const,
      quality_score: Number(g.quality_score || 0),
      topic_verified: matches,
      no_duplicate: !duplicate,
      quality_passed: Number(g.quality_score || 0) >= 70,
      hash: ""
    };
    prepared.hash = buildQuestionHash({
      subject: prepared.subject,
      topic: prepared.subcategory,
      question: prepared.question,
      choice_a: prepared.choice_a,
      choice_b: prepared.choice_b,
      choice_c: prepared.choice_c,
      choice_d: prepared.choice_d,
      correct_answer: prepared.correct_answer
    });
    valid.push(prepared);
    return true;
  }

  for (const [index, g] of generated.entries()) {
    await tryAcceptCandidate(g);
    const validationProgress = Math.round(42 + (((index + 1) / Math.max(generated.length, 1)) * 28));
    await report(validationProgress, "validating", `Validated ${index + 1}/${generated.length} generated questions`);
  }

  let fillAttempts = 0;
  const maxFillAttempts = Math.max(requestedCount * 3, 12);
  while (valid.length < generationTarget && fillAttempts < maxFillAttempts) {
    fillAttempts += 1;
    const remaining = generationTarget - valid.length;
    const batchSize = Math.min(Math.max(remaining, 1), 5);
    await report(72, "top-up", `Generating ${batchSize} replacement question${batchSize > 1 ? "s" : ""} to reach ${requestedCount}`);
    try {
      const replRows = await generateWithPythonEngine({
        category: payload.category,
        subcategory: payload.subcategory,
        count: batchSize,
        difficulty: payload.difficulty,
        offset: payload.count + (fillAttempts * batchSize) + valid.length
      });
      if (!Array.isArray(replRows) || replRows.length === 0) {
        continue;
      }
      for (const replRow of replRows) {
        if (valid.length >= generationTarget) {
          break;
        }
        await tryAcceptCandidate(replRow);
      }
      const topUpProgress = Math.min(88, 72 + Math.round((valid.length / Math.max(generationTarget, 1)) * 16));
      await report(topUpProgress, "top-up", `Accepted ${cachedRows.length + valid.length}/${requestedCount} questions after top-up`);
    } catch (e) {
      // keep trying until cap
    }
  }

  if (valid.length < generationTarget) {
    const remaining = generationTarget - valid.length;
    await report(86, "final-top-up", `Final fallback pass for remaining ${remaining} questions`);
    try {
      const finalRows = await generateWithPythonEngine({
        category: payload.category,
        subcategory: payload.subcategory,
        count: remaining,
        difficulty: payload.difficulty,
        offset: (payload.count * 20) + valid.length
      });
      for (const finalRow of finalRows) {
        if (valid.length >= generationTarget) {
          break;
        }
        await tryAcceptCandidate({ ...finalRow, generation_mode: "fallback-final", source: "nlp-fallback-final" }, { finalFallback: true });
      }
    } catch (e) {
      // final rescue is best-effort
    }
  }

  const genTimestamp = new Date().toISOString();
  let saved = 0;
  let before = 0;
  let after = 0;
  if (valid.length > 0) {
    await report(92, "saving", `Saving ${valid.length} validated questions`);
    const res = await saveWithRetry(valid);
    saved = res.saved;
    before = res.before;
    after = res.after;
  } else {
    before = (await loadQuestions()).length;
    after = before;
    throw new Error("Python AI generated questions but none passed validation.");
  }

  try {
    await appendGenerationLog({ timestamp: genTimestamp, topic: payload.subcategory, generated: generated.length, saved, rejected: rejected.length, fallbackUsed: valid.some((row) => String(row.source).includes("fallback")), qualityThreshold: 70 });
  } catch (e) {
    // non-fatal
  }

  await appendImportLog({ import_time: genTimestamp, questions_generated: generated.length, questions_saved: saved, database_total_before: before, database_total_after: after, rejected_questions: rejected.length, topic: payload.subcategory });

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
    clearedAi: 0,
    requested: payload.count,
    completionPercent: Math.round((saved / Math.max(payload.count, 1)) * 100),
    fallbackUsed: false
  };
}

export async function refreshQuestionList() {
  const { refreshQuestionList: refresh } = await import("./question-service");
  return await refresh();
}
