import { z } from "zod";

import { env } from "@/lib/env";
import { EXAM_CATEGORIES, SUBJECT_SUBCATEGORIES, getDefaultSubcategory, isSupportedSubcategory } from "@/lib/constants";
import type { ExamCategory, ExamSubcategory, QuestionDifficulty, QuestionRecord } from "@/lib/types";

const generatedQuestionSchema = z.object({
  subject: z.enum(EXAM_CATEGORIES),
  subcategory: z.string().min(2),
  question: z.string().min(10),
  choice_a: z.string().min(1),
  choice_b: z.string().min(1),
  choice_c: z.string().min(1),
  choice_d: z.string().min(1),
  correct_answer: z.enum(["A", "B", "C", "D"]),
  explanation: z.string().min(3)
});

const generatedResponseSchema = z.array(generatedQuestionSchema);

const classificationSchema = z.object({
  subject: z.enum(EXAM_CATEGORIES),
  subcategory: z.string().min(2)
});

const validationSchema = z.object({
  isQuestion: z.boolean(),
  isMultipleChoice: z.boolean(),
  hasFourChoices: z.boolean(),
  isRelevant: z.boolean(),
  subject: z.enum(EXAM_CATEGORIES).nullable(),
  subcategory: z.string().nullable(),
  question: z.string().nullable(),
  choices: z.array(z.string()).max(4).optional(),
  correct_answer: z.enum(["A", "B", "C", "D"]).nullable().optional(),
  explanation: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional()
});

function stripCodeFence(input: string) {
  return input.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
}

async function callJsonModel<T>(schema: z.ZodSchema<T>, prompt: string, systemPrompt: string) {
  if (!env.llmApiKey) {
    throw new Error("Missing OPEN_SOURCE_LLM_API_KEY configuration");
  }

  const response = await fetch(`${env.llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.llmApiKey}`
    },
    body: JSON.stringify({
      model: env.llmModel,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ]
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`LLM request failed: ${message}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("LLM response did not contain content");
  }

  return schema.parse(JSON.parse(stripCodeFence(content)));
}

function normalizeSubcategory(subject: ExamCategory, subcategory: string | null | undefined): ExamSubcategory {
  if (subcategory && isSupportedSubcategory(subject, subcategory)) {
    return subcategory;
  }

  return getDefaultSubcategory(subject);
}

export async function classifyQuestion(questionText: string): Promise<{ subject: ExamCategory; subcategory: ExamSubcategory }> {
  const prompt = [
    "Classify the following Thai civil service exam question.",
    `Supported subjects: ${EXAM_CATEGORIES.join(", ")}`,
    "Return strict JSON with keys: subject, subcategory.",
    `Question: ${questionText}`
  ].join("\n");

  const result = await callJsonModel(
    classificationSchema,
    prompt,
    "You classify Thai civil service exam questions into supported subjects and subcategories. Return JSON only."
  );

  return {
    subject: result.subject,
    subcategory: normalizeSubcategory(result.subject, result.subcategory)
  };
}

export async function validateImportedQuestion(candidate: string) {
  const prompt = [
    "Validate whether this text is a valid Thai civil service multiple choice exam question.",
    `Supported subjects: ${EXAM_CATEGORIES.join(", ")}`,
    "Rules: reject if not multiple choice, fewer than 4 choices, not an exam question, or irrelevant.",
    "Return strict JSON with these keys:",
    "isQuestion, isMultipleChoice, hasFourChoices, isRelevant, subject, subcategory, question, choices, correct_answer, explanation, rejectionReason",
    `Candidate text:\n${candidate}`
  ].join("\n");

  const result = await callJsonModel(
    validationSchema,
    prompt,
    "You validate imported Thai civil service exam questions and return strict JSON only."
  );

  if (!result.isQuestion || !result.isMultipleChoice || !result.hasFourChoices || !result.isRelevant || !result.subject || !result.question || !result.choices || result.choices.length !== 4 || !result.correct_answer) {
    return {
      valid: false as const,
      reason: result.rejectionReason || "Rejected by AI validation"
    };
  }

  return {
    valid: true as const,
    question: {
      subject: result.subject,
      category: result.subject,
      subcategory: normalizeSubcategory(result.subject, result.subcategory),
      question: result.question,
      choice_a: result.choices[0],
      choice_b: result.choices[1],
      choice_c: result.choices[2],
      choice_d: result.choices[3],
      correct_answer: result.correct_answer,
      explanation: result.explanation || "Validated from PDF import",
      difficulty: "medium" as QuestionDifficulty,
      source: "pdf" as const
    }
  };
}

export async function generateQuestionsWithAI(input: {
  category: ExamCategory;
  subcategory: ExamSubcategory;
  count: number;
  difficulty: QuestionDifficulty;
}): Promise<Array<Omit<QuestionRecord, "id" | "createdAt">>> {
  const prompt = [
    "Generate Thai civil service exam practice questions as strict JSON.",
    `Subject: ${input.category}`,
    `Subcategory: ${input.subcategory}`,
    `Difficulty: ${input.difficulty}`,
    `Question count: ${input.count}`,
    "Return an array only.",
    "Each item must include: subject, subcategory, question, choice_a, choice_b, choice_c, choice_d, correct_answer, explanation.",
    "All questions must be four-choice multiple choice questions.",
    "Do not include markdown or extra commentary."
  ].join("\n");

  const rows = await callJsonModel(
    generatedResponseSchema,
    prompt,
    "You generate high-quality Thai civil service exam questions in valid JSON only."
  );

  return rows.map((row) => ({
    ...row,
    subject: input.category,
    category: input.category,
    subcategory: normalizeSubcategory(input.category, row.subcategory || input.subcategory),
    difficulty: input.difficulty,
    source: "ai" as const
  }));
}

export function getSupportedSubcategories(subject: ExamCategory) {
  return SUBJECT_SUBCATEGORIES[subject];
}
