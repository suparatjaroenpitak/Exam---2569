import { z } from "zod";

import { env } from "@/lib/env";
import { EXAM_CATEGORIES, SUBJECT_SUBCATEGORIES, getDefaultSubcategory, isSupportedSubcategory } from "@/lib/constants";
import { splitPdfIntoQuestionCandidates } from "@/lib/pdf-question-parser";
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

const importedPdfQuestionSchema = z.object({
  subject: z.enum(EXAM_CATEGORIES),
  subcategory: z.string().min(2),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  question: z.string().min(10),
  choice_a: z.string().min(1),
  choice_b: z.string().min(1),
  choice_c: z.string().min(1),
  choice_d: z.string().min(1),
  correct_answer: z.enum(["A", "B", "C", "D"]),
  explanation: z.string().min(3).optional()
});

const importedPdfResponseSchema = z.array(importedPdfQuestionSchema);

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

function getSubjectGuideText() {
  return EXAM_CATEGORIES.map((subject) => {
    const subcategories = SUBJECT_SUBCATEGORIES[subject].join(", ");
    return `- ${subject}: ${subcategories}`;
  }).join("\n");
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

async function callOpenAIJsonModel<T>(schema: z.ZodSchema<T>, prompt: string, systemPrompt: string) {
  if (!env.openAiApiKey) {
    throw new Error("Missing OPENAI_API_KEY (Hugging Face) configuration");
  }

  // Combine system and user prompts into a single input for the HF text-generation endpoint
  const inputText = `${systemPrompt}\n\n${prompt}`;

  const response = await fetch(`${env.openAiBaseUrl}/models/${env.openAiModel}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.openAiApiKey}`
    },
    body: JSON.stringify({
      inputs: inputText,
      parameters: {
        max_new_tokens: 1024,
        temperature: 0.1
      }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text();
    try {
      const parsed = JSON.parse(message);
      const err = parsed?.error || parsed?.message || parsed;
      if (typeof err === "string" && /not a valid model id/i.test(err)) {
        throw new Error(
          `Invalid model id '${env.openAiModel}'. Set OPENAI_MODEL to a valid Hugging Face model ID (see https://huggingface.co/models). Original error: ${err}`
        );
      }
    } catch (e) {
      // ignore parse errors and fall through to generic message
    }

    throw new Error(`Hugging Face request failed: ${message}`);
  }

  const data = await response.json().catch(async () => {
    // Some HF endpoints may return plain text
    return (await response.text()) as any;
  });

  let content: string | null = null;

  if (!data) {
    content = null;
  } else if (typeof data === "string") {
    content = data;
  } else if (Array.isArray(data)) {
    // HF sometimes returns an array of generations
    if (data[0] && typeof data[0] === "object" && "generated_text" in data[0]) {
      content = data.map((d: any) => d.generated_text).join("\n");
    } else if (typeof data[0] === "string") {
      content = data.join("");
    }
  } else if (typeof data === "object") {
    if ("generated_text" in data) {
      content = (data as any).generated_text;
    } else if ("error" in data) {
      throw new Error(`Hugging Face error: ${(data as any).error}`);
    } else if (data.hasOwnProperty("outputs") && Array.isArray((data as any).outputs) && (data as any).outputs[0]?.generated_text) {
      content = (data as any).outputs.map((o: any) => o.generated_text).join("\n");
    }
  }

  if (!content) {
    throw new Error("Hugging Face response did not contain content");
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
    "Use only these supported subcategories for each subject:",
    getSubjectGuideText(),
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
    "Use only these supported subcategories for each subject:",
    getSubjectGuideText(),
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
    `Allowed subcategories for ${input.category}: ${SUBJECT_SUBCATEGORIES[input.category].join(", ")}`,
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

function chunkPdfText(text: string, maxChars = 8_000) {
  const blocks = splitPdfIntoQuestionCandidates(text);

  if (blocks.length > 0) {
    return blocks.reduce<string[]>((chunks, block) => {
      const current = chunks[chunks.length - 1];
      if (!current || current.length + block.length + 2 > maxChars) {
        chunks.push(block);
      } else {
        chunks[chunks.length - 1] = `${current}\n\n${block}`;
      }
      return chunks;
    }, []);
  }

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.reduce<string[]>((chunks, line) => {
    const current = chunks[chunks.length - 1];
    if (!current || current.length + line.length + 1 > maxChars) {
      chunks.push(line);
    } else {
      chunks[chunks.length - 1] = `${current}\n${line}`;
    }
    return chunks;
  }, []);
}

export async function extractQuestionsFromPdfWithOpenAI(input: {
  text: string;
  maxQuestions?: number;
}): Promise<Array<Omit<QuestionRecord, "id" | "createdAt">>> {
  const maxQuestions = input.maxQuestions ?? 200;
  const chunks = chunkPdfText(input.text).slice(0, 12);
  const collected: Array<Omit<QuestionRecord, "id" | "createdAt">> = [];

  for (const chunk of chunks) {
    if (collected.length >= maxQuestions) {
      break;
    }

    const remaining = maxQuestions - collected.length;
    const prompt = [
      "Extract Thai civil service multiple-choice questions from the PDF text below.",
      `Return strict JSON array only, with no markdown, up to ${Math.min(remaining, 25)} items.`,
      `Supported subjects: ${EXAM_CATEGORIES.join(", ")}`,
      "Use only these supported subcategories for each subject:",
      getSubjectGuideText(),
      "Rules:",
      "- Keep only valid four-choice multiple choice questions.",
      "- Infer subject, subcategory, and difficulty.",
      "- Each item must include: subject, subcategory, difficulty, question, choice_a, choice_b, choice_c, choice_d, correct_answer, explanation.",
      "- If the source text is not a valid question, omit it.",
      "- If answer labels are Thai letters, convert them to A/B/C/D.",
      "PDF text:",
      chunk
    ].join("\n");

    const rows = await callOpenAIJsonModel(
      importedPdfResponseSchema,
      prompt,
      "You extract and normalize Thai civil service exam questions from PDF text. Return valid JSON only."
    );

    for (const row of rows) {
      if (collected.length >= maxQuestions) {
        break;
      }

      const subject = row.subject;
      collected.push({
        subject,
        category: subject,
        subcategory: normalizeSubcategory(subject, row.subcategory),
        difficulty: row.difficulty ?? "medium",
        question: row.question.trim(),
        choice_a: row.choice_a.trim(),
        choice_b: row.choice_b.trim(),
        choice_c: row.choice_c.trim(),
        choice_d: row.choice_d.trim(),
        correct_answer: row.correct_answer,
        explanation: row.explanation?.trim() || "Imported from PDF using WangchanBERTa",
        source: "pdf"
      });
    }
  }

  const seen = new Set<string>();
  return collected.filter((row) => {
    const key = row.question.replace(/\s+/g, " ").trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function generateQuestionsWithoutLLM(input: {
  category: ExamCategory;
  subcategory: ExamSubcategory;
  count: number;
  difficulty: QuestionDifficulty;
}): Promise<Array<Omit<QuestionRecord, "id" | "createdAt">>> {
  const rows: Array<Omit<QuestionRecord, "id" | "createdAt">> = [];

  for (let i = 0; i < input.count; i++) {
    const diff = input.difficulty;
    const subject = input.category;
    // Simple template-based generators
    if (subject === "Analytical Thinking") {
      const a = randInt(2, diff === "easy" ? 12 : diff === "medium" ? 30 : 120);
      const b = randInt(1, diff === "easy" ? 10 : diff === "medium" ? 20 : 60);
      const op = Math.random() < 0.5 ? "+" : "-";
      const question = `หาก ${a} ${op} x = ${a + (op === "+" ? b : -b)}, ค่า x เท่ากับเท่าใด?`;
      const correct = op === "+" ? String(b) : String(-b);
      const wrongs = [String(b + 1), String(Math.max(1, b - 1)), String(b + 2)];
      const choices = shuffle([correct, ...wrongs]);
      const correctIndex = choices.indexOf(correct);
      rows.push({
        subject,
        category: subject,
        subcategory: input.subcategory,
        question,
        choice_a: choices[0],
        choice_b: choices[1],
        choice_c: choices[2],
        choice_d: choices[3],
        correct_answer: (["A", "B", "C", "D"] as const)[correctIndex],
        explanation: `แก้สมการให้ได้ค่า x = ${correct}`,
        difficulty: diff,
        source: "ai"
      });
    } else if (subject === "Thai Language") {
      const words = ["ความหมาย", "คำศัพท์", "ประโยค", "การอ่าน", "การสะกด"];
      const target = words[randInt(0, words.length - 1)];
      const question = `คำใดมีความหมายใกล้เคียงกับ "${target}" มากที่สุด?`;
      const correct = target;
      const wrongs = shuffle(words.filter((w) => w !== target)).slice(0, 3);
      const choices = shuffle([correct, ...wrongs]);
      const correctIndex = choices.indexOf(correct);
      rows.push({
        subject,
        category: subject,
        subcategory: input.subcategory,
        question,
        choice_a: choices[0],
        choice_b: choices[1],
        choice_c: choices[2],
        choice_d: choices[3],
        correct_answer: (["A", "B", "C", "D"] as const)[correctIndex],
        explanation: `คำที่ใกล้เคียงกับ "${target}" คือ "${correct}"`,
        difficulty: diff,
        source: "ai"
      });
    } else if (subject === "English Language") {
      const vocab = [
        ["big", "large"],
        ["small", "tiny"],
        ["happy", "joyful"],
        ["quick", "fast"]
      ];
      const pair = vocab[randInt(0, vocab.length - 1)];
      const question = `Choose the synonym of "${pair[0]}".`;
      const correct = pair[1];
      const wrongs = shuffle(vocab.map((p) => p[1]).filter((w) => w !== correct)).slice(0, 3);
      const choices = shuffle([correct, ...wrongs]);
      const correctIndex = choices.indexOf(correct);
      rows.push({
        subject,
        category: subject,
        subcategory: input.subcategory,
        question,
        choice_a: choices[0],
        choice_b: choices[1],
        choice_c: choices[2],
        choice_d: choices[3],
        correct_answer: (["A", "B", "C", "D"] as const)[correctIndex],
        explanation: `Synonym of ${pair[0]} is ${correct}`,
        difficulty: diff,
        source: "ai"
      });
    } else {
      // Government Law & Ethics
      const acts = [
        "พ.ร.บ.มาตราฐานทางจริยธรรม 2562",
        "พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่",
        "พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539"
      ];
      const act = acts[randInt(0, acts.length - 1)];
      const question = `ข้อใดเกี่ยวข้องกับ ${act}?`;
      const correct = act;
      const wrongs = shuffle(acts.filter((a) => a !== act)).slice(0, 3);
      const choices = shuffle([correct, ...wrongs]);
      const correctIndex = choices.indexOf(correct);
      rows.push({
        subject,
        category: subject,
        subcategory: input.subcategory,
        question,
        choice_a: choices[0],
        choice_b: choices[1],
        choice_c: choices[2],
        choice_d: choices[3],
        correct_answer: (["A", "B", "C", "D"] as const)[correctIndex],
        explanation: `กฎหมายที่เกี่ยวข้องคือ ${correct}`,
        difficulty: diff,
        source: "ai"
      });
    }
  }

  return rows;
}
