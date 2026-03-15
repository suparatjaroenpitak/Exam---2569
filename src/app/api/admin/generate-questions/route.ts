import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiAdmin } from "@/lib/api-guards";
import { EXAM_CATEGORIES, SUBJECT_SUBCATEGORIES } from "@/lib/constants";
import type { ExamSubcategory } from "@/lib/types";
import { DIFFICULTY_OPTIONS } from "@/lib/constants";
import { generateQuestionsWithAI } from "@/services/ai-question-service";
import { appendStructuredQuestions } from "@/services/exam-service";
import { env } from "@/lib/env";

const generateSchema = z.object({
  category: z.enum(EXAM_CATEGORIES),
  subcategory: z.string().min(2),
  count: z.number().int().min(1).max(100),
  difficulty: z.enum(DIFFICULTY_OPTIONS)
});

export async function POST(request: NextRequest) {
  const guard = await requireApiAdmin(request);

  if (guard.error) {
    return guard.error;
  }

  try {
    if (!env.llmApiKey) {
      return NextResponse.json({ message: "OPEN_SOURCE_LLM_API_KEY not configured. Set OPEN_SOURCE_LLM_API_KEY in environment." }, { status: 400 });
    }

    const payload = generateSchema.parse(await request.json());

    if (!SUBJECT_SUBCATEGORIES[payload.category].includes(payload.subcategory as (typeof SUBJECT_SUBCATEGORIES)[typeof payload.category][number])) {
      return NextResponse.json({ message: "Invalid subcategory for selected subject" }, { status: 400 });
    }

    const generated = await generateQuestionsWithAI({
      ...payload,
      subcategory: payload.subcategory as ExamSubcategory
    });
    const inserted = await appendStructuredQuestions(generated);

    return NextResponse.json({ message: `Generated and saved ${inserted.length} questions` });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "AI generation failed" },
      { status: 400 }
    );
  }
}
