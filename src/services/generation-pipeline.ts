import { generateQuestionsWithTemplates, generateQuestionsWithWangchanNlp } from "./wangchan-nlp-service";
import { aiValidateQuestion } from "./ai-validator";
import { isDuplicate, topicMatches, computeQualityScore, validateShape } from "@/services/ai-validation-service";
import { generateWithPythonEngine } from "@/services/python-ai-service";
import { loadQuestions, appendQuestions, restoreFromBackup } from "@/lib/excel-db";
import { appendGenerationLog } from "@/lib/generation-log";
import { appendImportLog } from "@/lib/import-log";

let isSaving = false;

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

export async function generateAndSave(payload: { category: string; subcategory: string; count: number; difficulty: string }) {
  // Generate with retries: sometimes the LLM returns malformed or empty results.
  const maxAttempts = 3;
  let generated: any[] = [];
  let fallbackUsed = false;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    generated = await generateQuestionsWithWangchanNlp({
      category: payload.category as any,
      subcategory: payload.subcategory as any,
      count: payload.count,
      difficulty: payload.difficulty as any,
      // Allow template fallback here so that if LLMs fail, we still get generated content
      allowTemplateFallback: true
    });

    if (Array.isArray(generated) && generated.length > 0) break;
    // small delay before retrying
    await new Promise((res) => setTimeout(res, 600));
  }

  // If after retries we still have zero generated questions, force a template fallback
  if (!Array.isArray(generated) || generated.length === 0) {
    // Use templates to guarantee output
    const templates = await generateQuestionsWithTemplates({
      category: payload.category as any,
      subcategory: payload.subcategory as any,
      count: payload.count,
      difficulty: payload.difficulty as any
    });
    generated = templates;
    fallbackUsed = true;
  }

  // Validate strictly with duplicate detection, topic matching, and quality scoring
  const valid: any[] = [];
  const rejected: any[] = [];

  const existingQuestions = (await loadQuestions()).map((r) => String(r.question || ""));

  for (const g of generated) {
    // shape check
    const baseCheck: any = validateQuestion(g);
    if (!baseCheck.valid) {
      rejected.push({ row: g, reason: baseCheck.reason });
      continue;
    }

    // run python-based shape validator (best-effort)
    try {
      const pyShape = await validateShape(g as any);
      if (pyShape === null || !pyShape.valid) {
        rejected.push({ row: g, reason: pyShape ? pyShape.reason : "python-validator-failed" });
        continue;
      }
    } catch (e) {
      // ignore python validator failures and continue
    }

    // topic match strict
    try {
      const matches = await topicMatches(String(payload.subcategory), `${g.question}\n${g.choice_a}\n${g.choice_b}\n${g.choice_c}\n${g.choice_d}`);
      if (!matches) {
        rejected.push({ row: g, reason: "topic-mismatch" });
        continue;
      }
    } catch (e) {
      rejected.push({ row: g, reason: "topic-check-failed" });
      continue;
    }

    // duplicate detection (against DB and accepted so far)
    try {
      const dupAgainstDB = await isDuplicate(g.question, existingQuestions, 0.85);
      const dupAgainstBatch = await isDuplicate(g.question, valid.map((v) => v.question || ""), 0.85);
      if (dupAgainstDB || dupAgainstBatch) {
        // attempt to regenerate replacement up to 3 times using Python engine
        let replaced = false;
        for (let rAttempt = 0; rAttempt < 3 && !replaced; rAttempt++) {
          try {
            const replRows = await generateWithPythonEngine({ category: payload.category, subcategory: payload.subcategory, count: 1, difficulty: payload.difficulty });
            if (Array.isArray(replRows) && replRows.length > 0) {
              const repl = replRows[0];
              const replDup = await isDuplicate(repl.question, existingQuestions.concat(valid.map((v) => v.question || "")), 0.85);
              const replTopic = await topicMatches(String(payload.subcategory), `${repl.question}\n${repl.choice_a}\n${repl.choice_b}\n${repl.choice_c}\n${repl.choice_d}`);
              if (!replDup && replTopic) {
                // accept replacement
                (repl as any).__needsReview = false;
                valid.push(repl as any);
                replaced = true;
                break;
              }
            }
          } catch (e) {
            // continue attempts
          }
        }

        if (!replaced) {
          rejected.push({ row: g, reason: "duplicate" });
        }
        continue;
      }
    } catch (e) {
      // if duplicate check fails, conservatively reject
      rejected.push({ row: g, reason: "duplicate-check-failed" });
      continue;
    }

    // compute quality score and enforce threshold >=70
    try {
      const qscore = computeQualityScore({ question: g.question, choice_a: g.choice_a, choice_b: g.choice_b, choice_c: g.choice_c, choice_d: g.choice_d, difficulty: payload.difficulty, topic: String(payload.subcategory) });
      (g as any).quality_score = qscore;
      if (qscore < 70) {
        rejected.push({ row: g, reason: `low-quality:${qscore}` });
        continue;
      }
    } catch (e) {
      // on scoring failure, mark for review but accept
      (g as any).quality_score = 50;
    }

    // Best-effort AI classifier: if it fails, mark for review but still accept minimal question
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
    await appendGenerationLog({ timestamp: genTimestamp, generated: generated.length, valid: valid.length, saved: saved, failed: rejected.length, fallbackUsed });
  } catch (e) {
    // non-fatal
  }

  // Append import log (existing JSON log for imports)
  await appendImportLog({ import_time: genTimestamp, questions_generated: generated.length, questions_saved: saved, database_total_before: before, database_total_after: after, rejected_questions: rejected.length });

  // Refresh client UI responsibility: route handler should call router.refresh() client-side.

  return { generated: generated.length, valid: valid.length, saved, rejected: rejected.length, totalBefore: before, totalAfter: after, fallbackUsed };
}

export async function refreshQuestionList() {
  const { refreshQuestionList: refresh } = await import("./question-service");
  return await refresh();
}
