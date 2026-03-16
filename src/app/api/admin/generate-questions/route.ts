import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiAdmin } from "@/lib/api-guards";
import { EXAM_CATEGORIES, SUBJECT_SUBCATEGORIES } from "@/lib/constants";
import type { ExamSubcategory } from "@/lib/types";
import { DIFFICULTY_OPTIONS } from "@/lib/constants";
import { generateQuestionsWithWangchanNlp } from "@/services/wangchan-nlp-service";
import { appendStructuredQuestions } from "@/services/exam-service";
import { aiValidateQuestion } from "@/services/ai-validator";
import { appendImportLog } from "@/lib/import-log";

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
    const payload = generateSchema.parse(await request.json());

    if (!SUBJECT_SUBCATEGORIES[payload.category].includes(payload.subcategory as (typeof SUBJECT_SUBCATEGORIES)[typeof payload.category][number])) {
      return NextResponse.json({ message: "Invalid subcategory for selected subject" }, { status: 400 });
    }
    const generated = await generateQuestionsWithWangchanNlp({ ...payload, subcategory: payload.subcategory as ExamSubcategory });

    const valid: typeof generated = [] as any;
    const rejected: Array<{ row: any; reason: string }> = [];
    for (const g of generated) {
      const ok = await aiValidateQuestion({ question: g.question, choices: [g.choice_a, g.choice_b, g.choice_c, g.choice_d], correct: g.correct_answer });
      if (ok.valid) valid.push(g);
      else rejected.push({ row: g, reason: JSON.stringify(ok.reasons) });
    }

    const inserted = valid.length > 0 ? await appendStructuredQuestions(valid as any) : [];
    await appendImportLog({ import_time: new Date().toISOString(), total_detected: generated.length, valid_questions: inserted.length, rejected_questions: rejected.length, reason: rejected.slice(0, 10) });

    return NextResponse.json({ message: `Generated ${generated.length}, saved ${inserted.length}, rejected ${rejected.length}` });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "NLP generation failed" },
      { status: 400 }
    );
  }
}
