import { NextResponse, type NextRequest } from "next/server";
import pdfParse from "pdf-parse";

import { requireApiAdmin } from "@/lib/api-guards";
import { splitPdfIntoQuestionCandidates, parseCandidate, classifyByKeywords, estimateDifficulty } from "@/lib/pdf-question-parser";
import { parseExcelQuestions } from "@/lib/excel-question-parser";
import { parseWordQuestions } from "@/lib/word-question-parser";
import { parseCsvQuestions } from "@/lib/csv-question-parser";
import { normalizeSubject, getDefaultSubcategory } from "@/lib/constants";
import type { AnswerKey, ExamCategory, ExamSubcategory, QuestionDifficulty, QuestionRecord } from "@/lib/types";
import { extractQuestionsFromPdfWithWangchanNlp } from "@/services/wangchan-nlp-service";
import { extractQuestionsWithOllama, isOllamaConfigured } from "@/services/ollama-service";
import { appendStructuredQuestions } from "@/services/exam-service";
import { aiValidateQuestion } from "@/services/ai-validator";
import { appendImportLog } from "@/lib/import-log";

const ALLOWED_EXTENSIONS = ["pdf", "xlsx", "xls", "docx", "csv"];

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin(request);
  if (guard.error) return guard.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const parser = formData.get("parser") as string | null;
    const useOllama = formData.get("useOllama") === "true";

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Invalid import payload" }, { status: 400 });
    }

    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ message: `Unsupported file type: .${ext}. Allowed: pdf, xlsx, xls, docx, csv` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let structured: Array<Omit<QuestionRecord, "id" | "createdAt">> = [];

    if (ext === "pdf") {
      const document = await pdfParse(buffer);
      const requestedThaiNlp = parser === "thai-nlp" || parser === "wangchan";

      if (requestedThaiNlp) {
        structured = await extractQuestionsFromPdfWithWangchanNlp({ text: document.text, maxQuestions: 200 });
      } else {
        structured = splitPdfIntoQuestionCandidates(document.text)
          .slice(0, 200)
          .map((candidate) => parseCandidate(candidate))
          .map((p) => {
            if (!p.choices || p.choices.length !== 4) return null;
            const classification = classifyByKeywords(p.raw || p.question);
            const difficulty = estimateDifficulty(p.question) as QuestionDifficulty;
            const normalized = (normalizeSubject(classification.subject) ?? "Analytical Thinking") as ExamCategory;
            return {
              subject: normalized,
              category: normalized,
              subcategory: (classification.subcategory ?? getDefaultSubcategory(normalized)) as ExamSubcategory,
              question: p.question,
              choice_a: p.choices[0] || "",
              choice_b: p.choices[1] || "",
              choice_c: p.choices[2] || "",
              choice_d: p.choices[3] || "",
              correct_answer: (p.correct_answer as AnswerKey) || "A",
              explanation: "Imported from PDF",
              difficulty,
              source: "pdf" as const
            };
          })
          .filter((r): r is Exclude<typeof r, null> => r !== null);
      }

      // If standard parsing found nothing and Ollama is available, try Ollama extraction
      if (structured.length === 0 && isOllamaConfigured() && useOllama) {
        const ollamaRows = await extractQuestionsWithOllama(document.text, 200);
        structured = ollamaRows;
      }
    } else if (ext === "xlsx" || ext === "xls") {
      structured = parseExcelQuestions(buffer);
    } else if (ext === "docx") {
      structured = await parseWordQuestions(buffer);
    } else if (ext === "csv") {
      structured = parseCsvQuestions(buffer);
    }

    if (structured.length === 0) {
      await appendImportLog({ import_time: new Date().toISOString(), file: file.name, total_detected: 0, valid_questions: 0, rejected_questions: 0, reason: "no candidates" });
      return NextResponse.json({ message: "No valid questions were parsed from the file" }, { status: 400 });
    }

    const validCandidates: typeof structured = [];
    const rejected: Array<{ candidate: any; reason: string }> = [];

    for (const s of structured) {
      const choices = [s.choice_a, s.choice_b, s.choice_c, s.choice_d];
      const aiResult = await aiValidateQuestion({ question: s.question, choices, correct: s.correct_answer });
      if (!aiResult.valid) {
        rejected.push({ candidate: s, reason: JSON.stringify(aiResult.reasons) });
        continue;
      }
      validCandidates.push(s);
    }

    const inserted = validCandidates.length > 0 ? await appendStructuredQuestions(validCandidates as any) : [];

    await appendImportLog({
      import_time: new Date().toISOString(),
      file: file.name,
      total_detected: structured.length,
      valid_questions: inserted.length,
      rejected_questions: rejected.length,
      reason: rejected.slice(0, 10)
    });

    return NextResponse.json({ message: `File "${file.name}": detected ${structured.length}, imported ${inserted.length}, rejected ${rejected.length}` });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "File import failed" },
      { status: 500 }
    );
  }
}
