import { SUBJECT_SUBCATEGORIES, getDefaultSubcategory, isSupportedSubcategory } from "@/lib/constants";
import { env } from "@/lib/env";
import { classifyByKeywords, estimateDifficulty, parseCandidate, splitPdfIntoQuestionCandidates } from "@/lib/pdf-question-parser";
import type { AnswerKey, ExamCategory, ExamSubcategory, QuestionDifficulty, QuestionRecord } from "@/lib/types";

const THAI_GENERATOR_NAME = "Typhoon2 Thai LLM";

const SUBCATEGORY_HINTS: Partial<Record<ExamSubcategory, string[]>> = {
  Percentage: ["ร้อยละ", "เปอร์เซ็นต์", "percent", "%"],
  Ratio: ["อัตราส่วน", "ratio"],
  Proportion: ["สัดส่วน", "proportion"],
  Equation: ["สมการ", "equation", "ค่า x", "แก้สมการ"],
  "Speed Distance Time": ["อัตราเร็ว", "ระยะทาง", "เวลา", "speed", "distance", "time"],
  "Number Comparison": ["เปรียบเทียบ", "มากกว่า", "น้อยกว่า", "comparison"],
  "Data Tables": ["ตารางข้อมูล", "data table"],
  "Logical Reasoning": ["เหตุผล", "ตรรกะ", "logical"],
  "Reading Comprehension": ["อ่านบทความ", "อ่านจับใจความ", "บทความ", "passage", "ย่อหน้า", "โจทย์"],
  Summarize: ["สรุป", "ใจความสำคัญ"],
  Interpretation: ["ตีความ", "interpret"],
  Synonym: ["คำไวพจน์", "ความหมายใกล้เคียง", "synonym", "ความหมายใกล้เคียงกับ"],
  Antonym: ["คำตรงข้าม", "antonym", "คำตรงข้ามกับ"],
  Tense: ["tense", "verb tense"],
  Preposition: ["preposition"],
  Conjunction: ["conjunction"],
  Article: ["article", "a an the"],
  "Vocabulary Synonym": ["synonym", "similar meaning"],
  "Vocabulary Antonym": ["antonym", "opposite meaning"],
  "Fill in the Blank": ["fill in the blank", "เติมคำในช่องว่าง", "___", "_____", "( )"],
  "Passage Reading": ["passage", "read the passage", "บทความ", "ย่อหน้า"],
  "Story Questions": ["story", "article", "dialogue", "เรื่อง", "บท"],
  "พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน 2534": ["ระเบียบบริหารราชการแผ่นดิน", "2534", "พ.ร.บ.", "พระราชบัญญัติ", "มาตรา", "บทบัญญัติ"],
  "พ.ร.ฎ.วิธีการบริหารกิจการบ้านเมืองที่ดี 2546": ["กิจการบ้านเมืองที่ดี", "2546", "พ.ร.ฎ.", "มาตรา"],
  "พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539": ["ปฏิบัติราชการทางปกครอง", "2539", "พ.ร.บ.", "มาตรา"],
  "ป.อ.2499 (ในส่วนความผิดต่อตำแหน่งหน้าที่ราชการ)": ["ป.อ.", "ความผิดต่อตำแหน่ง", "2499", "ประมวลกฎหมาย"],
  "พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่": ["ละเมิดของเจ้าหน้าที่", "ความรับผิด", "พ.ร.บ."],
  "พ.ร.บ.มาตราฐานทางจริยธรรม 2562": ["จริยธรรม", "2562", "มาตรฐานทางจริยธรรม", "พ.ร.บ."]
};

function scoreHintMatches(text: string, hints: readonly string[]) {
  const normalized = text.toLowerCase();
  return hints.reduce((score, hint) => score + (normalized.includes(hint.toLowerCase()) ? 1 : 0), 0);
}

function inferSubcategory(subject: ExamCategory, text: string): ExamSubcategory {
  const subcategories = SUBJECT_SUBCATEGORIES[subject];
  let best = getDefaultSubcategory(subject);
  let bestScore = 0;

  for (const subcategory of subcategories) {
    const hints = SUBCATEGORY_HINTS[subcategory] ?? [subcategory];
    const score = scoreHintMatches(text, hints);
    if (score > bestScore) {
      best = subcategory;
      bestScore = score;
    }
  }

  return best;
}

function normalizeSubcategory(subject: ExamCategory, subcategory: string | null | undefined): ExamSubcategory {
  if (subcategory && isSupportedSubcategory(subject, subcategory)) {
    return subcategory;
  }

  return getDefaultSubcategory(subject);
}

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function buildRowFingerprint(row: Pick<QuestionRecord, "question" | "choice_a" | "choice_b" | "choice_c" | "choice_d" | "correct_answer">) {
  const question = normalizeText(row.question).toLowerCase();
  const choices = [row.choice_a, row.choice_b, row.choice_c, row.choice_d].map((choice) => normalizeText(choice).toLowerCase());
  const sortedChoices = choices.slice().sort();
  const keyMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  const correctIndex = keyMap[String(row.correct_answer) || ""];
  const correctText = typeof correctIndex === "number" ? choices[correctIndex] ?? "" : "";

  return [question, sortedChoices.join("||"), correctText].join("||");
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

    const matchedChoiceIndex = choices.findIndex((choice) => normalizeText(choice).toLowerCase() === normalizeText(value).toLowerCase());
    if (matchedChoiceIndex >= 0) {
      return (["A", "B", "C", "D"] as const)[matchedChoiceIndex];
    }
  }

  if (typeof value === "number" && value >= 0 && value <= 3) {
    return (["A", "B", "C", "D"] as const)[value];
  }

  return "A";
}

function buildGenerationPrompt(input: {
  category: ExamCategory;
  subcategory: ExamSubcategory;
  count: number;
  difficulty: QuestionDifficulty;
}) {
  const strictLawRule = input.category === "Government Law & Ethics"
    ? `All question stems, correct answers, and explanations must stay strictly within the exact law subcategory \"${input.subcategory}\". Do not change to another act. Distractors may reference other acts, but the question itself must test only \"${input.subcategory}\".`
    : "Keep every question within the exact requested subcategory.";

  return [
    "You are an expert Thai exam author for Thai civil service practice tests.",
    `Create ${input.count} unique multiple-choice questions in Thai for category \"${input.category}\" and subcategory \"${input.subcategory}\" at \"${input.difficulty}\" difficulty.`,
    strictLawRule,
    "Requirements:",
    "- Return JSON only. No markdown. No prose.",
    "- The JSON must be an array of objects.",
    "- Each object must contain: question, choice_a, choice_b, choice_c, choice_d, correct_answer, explanation.",
    "- correct_answer must be one of A, B, C, D.",
    "- Every question must be different from the others.",
    "- Choices must be plausible and non-duplicated.",
    "- explanation must be concise and accurate.",
    "- If the subject is English Language, the question content may be English. Otherwise prefer Thai.",
    "Example output:",
    "[{\"question\":\"...\",\"choice_a\":\"...\",\"choice_b\":\"...\",\"choice_c\":\"...\",\"choice_d\":\"...\",\"correct_answer\":\"A\",\"explanation\":\"...\"}]"
  ].join("\n");
}

async function callThaiGenerativeModel(input: {
  category: ExamCategory;
  subcategory: ExamSubcategory;
  count: number;
  difficulty: QuestionDifficulty;
}) {
  const prompt = buildGenerationPrompt(input);
  const url = `${env.thaiGeneratorBaseUrl.replace(/\/$/, "")}/${env.thaiGeneratorModel}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.huggingFaceApiKey ? { Authorization: `Bearer ${env.huggingFaceApiKey}` } : {})
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        return_full_text: false,
        do_sample: true,
        temperature: 0.85,
        top_p: 0.92,
        max_new_tokens: Math.max(900, input.count * 220)
      },
      options: {
        wait_for_model: true,
        use_cache: false
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = typeof payload?.error === "string"
      ? payload.error
      : payload?.error?.message || payload?.message || `Thai model request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (Array.isArray(payload) && typeof payload[0]?.generated_text === "string") {
    return payload[0].generated_text as string;
  }

  if (typeof payload?.generated_text === "string") {
    return payload.generated_text as string;
  }

  throw new Error("Thai generative model returned an unsupported response shape");
}

function normalizeGeneratedRows(
  input: { category: ExamCategory; subcategory: ExamSubcategory; difficulty: QuestionDifficulty },
  rawRows: unknown
): Array<Omit<QuestionRecord, "id" | "createdAt">> {
  const rowsArray = Array.isArray(rawRows)
    ? rawRows
    : rawRows && typeof rawRows === "object" && Array.isArray((rawRows as { questions?: unknown[] }).questions)
      ? (rawRows as { questions: unknown[] }).questions
      : [];

  const seen = new Set<string>();

  return rowsArray.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const choices = Array.isArray(record.choices)
      ? (record.choices as unknown[]).map((choice) => normalizeText(choice)).slice(0, 4)
      : [
          normalizeText(record.choice_a),
          normalizeText(record.choice_b),
          normalizeText(record.choice_c),
          normalizeText(record.choice_d)
        ];

    if (choices.length !== 4 || choices.some((choice) => !choice)) {
      return [];
    }

    const question = normalizeText(record.question);
    const explanation = normalizeText(record.explanation) || `Generated by ${THAI_GENERATOR_NAME}`;
    if (question.length < 12) {
      return [];
    }

    const correctAnswer = resolveCorrectAnswerKey(record.correct_answer, choices);
    const subcategory = isSupportedSubcategory(input.category, input.subcategory)
      ? input.subcategory
      : inferSubcategory(input.category, `${question}\n${choices.join("\n")}`);

    const normalizedRow = {
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
      source: "llm" as const
    };

    const fingerprint = buildRowFingerprint(normalizedRow);
    if (seen.has(fingerprint)) {
      return [];
    }
    seen.add(fingerprint);
    return [normalizedRow];
  });
}

async function generateQuestionsWithThaiModel(input: {
  category: ExamCategory;
  subcategory: ExamSubcategory;
  count: number;
  difficulty: QuestionDifficulty;
}) {
  const generatedText = await callThaiGenerativeModel(input);
  const jsonPayload = extractJsonPayload(generatedText);
  return normalizeGeneratedRows(input, JSON.parse(jsonPayload)).slice(0, input.count);
}

export async function classifyQuestion(questionText: string): Promise<{ subject: ExamCategory; subcategory: ExamSubcategory }> {
  const classification = classifyByKeywords(questionText);
  const subject = classification.subject as ExamCategory;

  return {
    subject,
    subcategory: normalizeSubcategory(subject, inferSubcategory(subject, questionText))
  };
}

export async function validateImportedQuestion(candidate: string) {
  const parsed = parseCandidate(candidate);
  const hasQuestion = parsed.question.trim().length >= 10;
  const hasFourChoices = parsed.choices.length === 4;
  const isMultipleChoice = parsed.choices.length >= 2;
  const looksRelevant = candidate.length > 20 && /\d|[ก-งA-D]/i.test(candidate);

  if (!hasQuestion || !isMultipleChoice || !hasFourChoices || !looksRelevant) {
    return {
      valid: false as const,
      reason: "Rejected by Thai NLP validation"
    };
  }

  const classified = await classifyQuestion(`${parsed.question}\n${parsed.choices.join("\n")}`);
  const correctAnswer: AnswerKey = parsed.correct_answer && ["A", "B", "C", "D"].includes(parsed.correct_answer)
    ? (parsed.correct_answer as AnswerKey)
    : "A";

  return {
    valid: true as const,
    question: {
      subject: classified.subject,
      category: classified.subject,
      subcategory: classified.subcategory,
      question: parsed.question,
      choice_a: parsed.choices[0],
      choice_b: parsed.choices[1],
      choice_c: parsed.choices[2],
      choice_d: parsed.choices[3],
      correct_answer: correctAnswer,
      explanation: parsed.correct_answer
        ? "Validated with Thai NLP parser"
        : "Imported with Thai NLP parser; no explicit answer key was found in source text.",
      difficulty: estimateDifficulty(parsed.question) as QuestionDifficulty,
      source: "pdf" as const
    }
  };
}

export async function generateQuestionsWithWangchanNlp(input: {
  category: ExamCategory;
  subcategory: ExamSubcategory;
  count: number;
  difficulty: QuestionDifficulty;
}): Promise<Array<Omit<QuestionRecord, "id" | "createdAt">>> {
  try {
    const generated = await generateQuestionsWithThaiModel(input);
    if (generated.length > 0) {
      return generated;
    }
  } catch {
    // Fall back to template generation if hosted inference is unavailable or malformed.
  }

  return generateQuestionsWithTemplates(input);
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

export async function extractQuestionsFromPdfWithWangchanNlp(input: {
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
    const candidates = splitPdfIntoQuestionCandidates(chunk);

    for (const candidate of candidates) {
      if (collected.length >= maxQuestions) {
        break;
      }

      const validated = await validateImportedQuestion(candidate);
      if (validated.valid) {
        collected.push(validated.question);
      }
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

export async function generateQuestionsWithTemplates(input: {
  category: ExamCategory;
  subcategory: ExamSubcategory;
  count: number;
  difficulty: QuestionDifficulty;
}): Promise<Array<Omit<QuestionRecord, "id" | "createdAt">>> {
  const rows: Array<Omit<QuestionRecord, "id" | "createdAt">> = [];
  const seenFingerprints = new Set<string>();
  const maxAttempts = Math.max(50, input.count * 6);
  let attempts = 0;

  while (rows.length < input.count && attempts < maxAttempts) {
    attempts++;
    const diff = input.difficulty;
    const subject = input.category;
    let question = "";
    let choices: string[] = [];
    let correct = "";

    if (subject === "Analytical Thinking") {
      const a = randInt(2, diff === "easy" ? 12 : diff === "medium" ? 30 : 120);
      const b = randInt(1, diff === "easy" ? 10 : diff === "medium" ? 20 : 60);
      const op = Math.random() < 0.5 ? "+" : "-";
      question = `หาก ${a} ${op} x = ${a + (op === "+" ? b : -b)}, ค่า x เท่ากับเท่าใด?`;
      correct = op === "+" ? String(b) : String(-b);
      const wrongs = [String(b + 1), String(Math.max(1, b - 1)), String(b + 2)];
      choices = shuffle([correct, ...wrongs]);
    } else if (subject === "Thai Language") {
      const words = ["ความหมาย", "คำศัพท์", "ประโยค", "การอ่าน", "การสะกด"];
      const target = words[randInt(0, words.length - 1)];
      question = `คำใดมีความหมายใกล้เคียงกับ "${target}" มากที่สุด?`;
      correct = target;
      const wrongs = shuffle(words.filter((w) => w !== target)).slice(0, 3);
      choices = shuffle([correct, ...wrongs]);
    } else if (subject === "English Language") {
      const vocab = [
        ["big", "large"],
        ["small", "tiny"],
        ["happy", "joyful"],
        ["quick", "fast"]
      ];
      const pair = vocab[randInt(0, vocab.length - 1)];
      question = `Choose the synonym of "${pair[0]}".`;
      correct = pair[1];
      const wrongs = shuffle(vocab.map((p) => p[1]).filter((w) => w !== correct)).slice(0, 3);
      choices = shuffle([correct, ...wrongs]);
    } else {
      const acts = [...SUBJECT_SUBCATEGORIES["Government Law & Ethics"]];
      // If the admin requested a specific subcategory (act) and it's supported,
      // use it consistently for generated questions instead of picking randomly.
      const requestedAct = isSupportedSubcategory("Government Law & Ethics", input.subcategory)
        ? input.subcategory
        : null;
      const act = requestedAct ?? acts[randInt(0, acts.length - 1)];
      question = `ข้อใดเกี่ยวข้องกับ ${act}?`;
      correct = act;
      const wrongs = shuffle(acts.filter((a) => a !== act)).slice(0, 3);
      choices = shuffle([correct, ...wrongs]);
    }

    // normalize and build fingerprint similar to question-service
    const qNorm = String(question).replace(/\s+/g, " ").trim().toLowerCase();
    const choiceNorms = choices.map((c) => String(c).replace(/\s+/g, " ").trim().toLowerCase());
    const sortedChoices = choiceNorms.slice().sort();
    const keyMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    const correctIndex = choices.indexOf(correct);
    const correctText = correctIndex >= 0 ? choiceNorms[correctIndex] : "";
    const fingerprint = [qNorm, sortedChoices.join("||"), correctText].join("||");

    if (seenFingerprints.has(fingerprint)) {
      continue;
    }

    seenFingerprints.add(fingerprint);

    // determine subcategory: use provided if valid, else infer per-question
    const finalSubcategory = isSupportedSubcategory(subject, input.subcategory)
      ? input.subcategory
      : inferSubcategory(subject, question);

    const correctKey = (["A", "B", "C", "D"] as const)[choices.indexOf(correct)];

    rows.push({
      subject,
      category: subject,
      subcategory: finalSubcategory,
      question,
      choice_a: choices[0] ?? "",
      choice_b: choices[1] ?? "",
      choice_c: choices[2] ?? "",
      choice_d: choices[3] ?? "",
      correct_answer: ([("A" as const), ("B" as const), ("C" as const), ("D" as const)][choices.indexOf(correct)]) || "A",
      explanation: subject === "Analytical Thinking" ? `แก้สมการให้ได้ค่า x = ${correct}` : subject === "Thai Language" ? `คำที่ใกล้เคียงกับ "${correct}" คือ "${correct}"` : subject === "English Language" ? `Synonym of ${choices[choices.indexOf(correct)]} is ${correct}` : `กฎหมายที่เกี่ยวข้องคือ ${correct}`,
      difficulty: diff,
      source: "llm"
    });
  }

  return rows;
}
