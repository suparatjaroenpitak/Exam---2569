import { NextResponse, type NextRequest } from "next/server";
import pdfParse from "pdf-parse";

import { requireApiAdmin } from "@/lib/api-guards";
import { splitPdfIntoQuestionCandidates, parseCandidate, classifyByKeywords, estimateDifficulty } from "@/lib/pdf-question-parser";
import type { QuestionDifficulty } from "@/lib/types";
import { appendStructuredQuestions } from "@/services/exam-service";

export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin(request);

  if (guard.error) {
    return guard.error;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Invalid import payload" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const document = await pdfParse(buffer);
    const candidates = splitPdfIntoQuestionCandidates(document.text).slice(0, 200);

    const parsed = candidates.map((candidate) => parseCandidate(candidate));

    const structured = parsed
      .map((p) => {
        if (!p.choices || p.choices.length !== 4) return null;
        const classification = classifyByKeywords(p.raw || p.question);
        const difficulty = estimateDifficulty(p.question) as QuestionDifficulty;

        return {
          subject: classification.subject,
          category: classification.subject,
          subcategory: classification.subcategory,
          question: p.question,
          choice_a: p.choices[0] || "",
          choice_b: p.choices[1] || "",
          choice_c: p.choices[2] || "",
          choice_d: p.choices[3] || "",
          correct_answer: p.correct_answer || "A",
          explanation: "Imported from PDF",
          difficulty,
          source: "pdf" as const
        };
      })
      .filter((r): r is Exclude<typeof r, null> => r !== null);

    if (structured.length === 0) {
      return NextResponse.json({ message: "No valid questions were parsed from the PDF" }, { status: 400 });
    }

    const inserted = await appendStructuredQuestions(structured);

    return NextResponse.json({
      message: `Imported ${inserted.length} questions from PDF`
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "PDF import failed" },
      { status: 500 }
    );
  }
}
