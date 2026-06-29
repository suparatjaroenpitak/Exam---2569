import { env } from "@/lib/env";
import { SUBJECT_SUBCATEGORIES, getDefaultSubcategory, isSupportedSubcategory } from "@/lib/constants";
import { classifyByKeywords, estimateDifficulty } from "@/lib/pdf-question-parser";
import type { AnswerKey, ExamCategory, ExamSubcategory, QuestionDifficulty, QuestionRecord } from "@/lib/types";

type GenerateInput = {
  category: ExamCategory;
  subcategory: ExamSubcategory;
  count: number;
  difficulty: QuestionDifficulty;
};

type GeneratedRow = Omit<QuestionRecord, "id" | "createdAt">;

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function extractJsonPayload(raw: string) {
  const fencedMatch = raw.match(/```json\s*([\s\S]*?)```/i) ?? raw.match(/```\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] ?? raw;
  const arrayStart = candidate.indexOf("[");
  const arrayEnd = candidate.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return candidate.slice(arrayStart, arrayEnd + 1);
  }
  const objectStart = candidate.indexOf("{");
  const objectEnd = candidate.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    return candidate.slice(objectStart, objectEnd + 1);
  }
  throw new Error("Model response did not contain valid JSON");
}

function resolveCorrectAnswerKey(value: unknown, choices: string[]): AnswerKey {
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    if (["A", "B", "C", "D"].includes(normalized)) {
      return normalized as AnswerKey;
    }
    const matchedIndex = choices.findIndex((c) => normalizeText(c).toLowerCase() === normalizeText(value).toLowerCase());
    if (matchedIndex >= 0) {
      return (["A", "B", "C", "D"] as const)[matchedIndex];
    }
  }
  if (typeof value === "number" && value >= 0 && value <= 3) {
    return (["A", "B", "C", "D"] as const)[value];
  }
  return "A";
}

function inferSubcategory(subject: ExamCategory, text: string): ExamSubcategory {
  const subcategories = SUBJECT_SUBCATEGORIES[subject];
  let best = getDefaultSubcategory(subject);
  let bestScore = 0;
  const lower = text.toLowerCase();
  for (const sub of subcategories) {
    let score = 0;
    const tokens = sub.toLowerCase().split(/[\s.]+/);
    for (const token of tokens) {
      if (token.length > 1 && lower.includes(token)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      best = sub;
      bestScore = score;
    }
  }
  return best;
}

function buildGenerationPrompt(input: GenerateInput): string {
  const strictLawRule = input.category === "Government Law & Ethics"
    ? `All question stems, correct answers, and explanations must stay strictly within the exact law subcategory "${input.subcategory}". Do not change to another act.`
    : "Keep every question within the exact requested subcategory.";
  return [
    "You are an expert Thai civil service exam author. Create multiple-choice questions in Thai for the ก.พ. (Khao Phan) exam.",
    `Category: "${input.category}", Subcategory: "${input.subcategory}", Difficulty: "${input.difficulty}".`,
    `Generate ${input.count} unique questions.`,
    strictLawRule,
    "Each question must have exactly 4 choices (choice_a, choice_b, choice_c, choice_d) and one correct_answer (A/B/C/D).",
    "Include an explanation for each correct answer.",
    "Return ONLY valid JSON array. No markdown, no prose.",
    'Example: [{"question":"...","choice_a":"...","choice_b":"...","choice_c":"...","choice_d":"...","correct_answer":"A","explanation":"..."}]'
  ].join("\n");
}

function buildExtractionPrompt(text: string, count: number): string {
  return [
    "You are an expert Thai exam parser. Extract multiple-choice questions from the following exam text.",
    "Return ONLY valid JSON array. Each object must have: question, choice_a, choice_b, choice_c, choice_d, correct_answer (A/B/C/D if detectable), explanation (optional).",
    "If you can detect the correct answer from the text, include it. Otherwise set correct_answer to \"A\".",
    "Extract as many complete questions as possible, up to " + count + ".",
    "If you cannot extract any question, return an empty array [].",
    "Text to parse:",
    text
  ].join("\n\n");
}

async function callOllama(prompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<string> {
  const baseUrl = env.ollamaBaseUrl.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("OLLAMA_BASE_URL is not configured. Set it to your Ollama server URL (e.g., https://xxxx.ngrok-free.app/api)");
  }
  const model = env.ollamaModel;
  const response = await fetch(`${baseUrl}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.8,
        num_predict: options?.maxTokens ?? 2048
      }
    })
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Ollama API error (${response.status}): ${errText}`);
  }
  const data = await response.json();
  if (data?.message?.content) {
    return data.message.content;
  }
  if (data?.response) {
    return data.response;
  }
  throw new Error("Ollama returned an unexpected response format");
}

function normalizeRows(
  input: GenerateInput,
  rawRows: unknown
): GeneratedRow[] {
  const rowsArray = Array.isArray(rawRows)
    ? rawRows
    : rawRows && typeof rawRows === "object" && Array.isArray((rawRows as { questions?: unknown[] }).questions)
      ? (rawRows as { questions: unknown[] }).questions
      : [];
  const seen = new Set<string>();
  return rowsArray.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const choices = [
      normalizeText(record.choice_a),
      normalizeText(record.choice_b),
      normalizeText(record.choice_c),
      normalizeText(record.choice_d)
    ];
    if (choices.length !== 4 || choices.some((c) => !c)) return [];
    const question = normalizeText(record.question);
    if (question.length < 10) return [];
    const explanation = normalizeText(record.explanation) || "Generated by Ollama AI";
    const correctAnswer = resolveCorrectAnswerKey(record.correct_answer, choices);
    const inferredSub = inferSubcategory(input.category, `${question}\n${choices.join("\n")}`);
    const subcategory = isSupportedSubcategory(input.category, input.subcategory)
      ? input.subcategory
      : inferredSub;
    const row: GeneratedRow = {
      subject: input.category,
      category: input.category,
      subcategory,
      difficulty: input.difficulty,
      question,
      choice_a: choices[0],
      choice_b: choices[1],
      choice_c: choices[2],
      choice_d: choices[3],
      correct_answer: correctAnswer,
      explanation,
      source: "llm"
    };
    const fp = [question.toLowerCase(), choices.slice().sort().join("||"), correctAnswer].join("||");
    if (seen.has(fp)) return [];
    seen.add(fp);
    return [row];
  });
}

export async function generateQuestionsWithOllama(input: GenerateInput): Promise<GeneratedRow[]> {
  if (!env.enableOllama || !env.ollamaBaseUrl) {
    return [];
  }
  const prompt = buildGenerationPrompt(input);
  const maxTokens = Math.max(2048, input.count * 300);
  const raw = await callOllama(prompt, { temperature: 0.85, maxTokens });
  const jsonStr = extractJsonPayload(raw);
  const parsed = JSON.parse(jsonStr);
  return normalizeRows(input, parsed).slice(0, input.count);
}

export async function extractQuestionsWithOllama(text: string, maxQuestions = 200): Promise<GeneratedRow[]> {
  if (!env.enableOllama || !env.ollamaBaseUrl) {
    return [];
  }
  const prompt = buildExtractionPrompt(text, maxQuestions);
  const raw = await callOllama(prompt, { temperature: 0.3, maxTokens: Math.max(2048, maxQuestions * 200) });
  let parsed: unknown;
  try {
    const jsonStr = extractJsonPayload(raw);
    parsed = JSON.parse(jsonStr);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  try {
    return parsed.flatMap((item: Record<string, unknown>) => {
      if (!item || typeof item !== "object") return [];
      const choices = [
        normalizeText(item.choice_a),
        normalizeText(item.choice_b),
        normalizeText(item.choice_c),
        normalizeText(item.choice_d)
      ];
      if (choices.length !== 4 || choices.some((c) => !c)) return [];
      const question = normalizeText(item.question);
      if (question.length < 10) return [];
      const explanation = normalizeText(item.explanation) || "Extracted via Ollama AI";
      const correctAnswer = resolveCorrectAnswerKey(item.correct_answer, choices);
      const rawText = `${question}\n${choices.join("\n")}`;
      const classification = classifyByKeywords(rawText);
      const subject = classification.subject as ExamCategory;
      const subcategory = inferSubcategory(subject, rawText);
      const difficulty = estimateDifficulty(question) as QuestionDifficulty;
      const fp = [question.toLowerCase(), choices.slice().sort().join("||")].join("||");
      if (seen.has(fp)) return [];
      seen.add(fp);
      return [{
        subject,
        category: subject,
        subcategory,
        difficulty,
        question,
        choice_a: choices[0],
        choice_b: choices[1],
        choice_c: choices[2],
        choice_d: choices[3],
        correct_answer: correctAnswer,
        explanation,
        source: "nlp"
      } as GeneratedRow];
    }).slice(0, maxQuestions);
  } catch { return []; }
}

export function isOllamaConfigured(): boolean {
  return env.enableOllama && Boolean(env.ollamaBaseUrl);
}
