import { NextResponse, type NextRequest } from "next/server";
import pdfParse from "pdf-parse";

import { requireApiAdmin } from "@/lib/api-guards";
import { splitPdfIntoQuestionCandidates, parseCandidate, classifyByKeywords, estimateDifficulty } from "@/lib/pdf-question-parser";
import { normalizeSubject, getDefaultSubcategory } from "@/lib/constants";
import type { QuestionDifficulty, ExamSubject, AnswerKey, QuestionRecord } from "@/lib/types";
import { extractQuestionsFromPdfWithWangchanNlp } from "@/services/wangchan-nlp-service";
import { appendStructuredQuestions } from "@/services/exam-service";

export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin(request);

  if (guard.error) {
    return guard.error;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const parser = formData.get("parser");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Invalid import payload" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const document = await pdfParse(buffer);
    const requestedWangchan = parser === "wangchan";

    const structured: Array<Omit<QuestionRecord, "id" | "createdAt">> = requestedWangchan
      ? await extractQuestionsFromPdfWithWangchanNlp({ text: document.text, maxQuestions: 200 })
      : splitPdfIntoQuestionCandidates(document.text)
          .slice(0, 200)
          .map((candidate) => parseCandidate(candidate))
          .map((p) => {
            if (!p.choices || p.choices.length !== 4) return null;
            const classification = classifyByKeywords(p.raw || p.question);
            const difficulty = estimateDifficulty(p.question) as QuestionDifficulty;

            const normalized = (normalizeSubject(classification.subject) ?? "Analytical Thinking") as ExamSubject;
            return {
              subject: normalized,
              category: normalized,
              subcategory: (classification.subcategory ?? getDefaultSubcategory(normalized)) as QuestionRecord["subcategory"],
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

    if (structured.length === 0) {
      return NextResponse.json({ message: "No valid questions were parsed from the PDF" }, { status: 400 });
    }

    const inserted = await appendStructuredQuestions(structured as any);

    return NextResponse.json({
      message: requestedWangchan
        ? `Imported ${inserted.length} questions from PDF using WangchanBERTa`
        : `Imported ${inserted.length} questions from PDF`
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "PDF import failed" },
      { status: 500 }
    );
  }
}
