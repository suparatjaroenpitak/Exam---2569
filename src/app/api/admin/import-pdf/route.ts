import { NextResponse, type NextRequest } from "next/server";
import pdfParse from "pdf-parse";

import { requireApiAdmin } from "@/lib/api-guards";
import { splitPdfIntoQuestionCandidates } from "@/lib/pdf-question-parser";
import type { QuestionDifficulty } from "@/lib/types";
import { appendStructuredQuestions } from "@/services/exam-service";
import { validateImportedQuestion } from "@/services/ai-question-service";
import { env } from "@/lib/env";

export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin(request);

  if (guard.error) {
    return guard.error;
  }

  try {
    if (!env.llmApiKey) {
      return NextResponse.json({ message: "OPEN_SOURCE_LLM_API_KEY not configured. Set OPEN_SOURCE_LLM_API_KEY in environment." }, { status: 400 });
    }
    const formData = await request.formData();
    const file = formData.get("file");
    const difficulty = formData.get("difficulty") as QuestionDifficulty | null;

    if (!(file instanceof File) || !difficulty) {
      return NextResponse.json({ message: "Invalid import payload" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const document = await pdfParse(buffer);
    const candidates = splitPdfIntoQuestionCandidates(document.text).slice(0, 200);
    const validated = await Promise.all(candidates.map((candidate) => validateImportedQuestion(candidate)));
    const structured = validated
      .flatMap((result) => (result.valid ? [{ ...result.question, difficulty }] : []));

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
