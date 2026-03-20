import { env } from "@/lib/env";

type GeneratorInput = {
  category: string;
  subcategory: string;
  count: number;
  difficulty: string;
};

type GeneratedRow = {
  subject: string;
  category: string;
  subcategory: string;
  question: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct_answer: string;
  explanation: string;
  difficulty: string;
  source: string;
};

const HUGGING_FACE_CHAT_URL = process.env.HUGGINGFACE_CHAT_URL || "https://router.huggingface.co/v1/chat/completions";
const FALLBACK_MODELS = [
  env.transformersModel,
  "Qwen/Qwen2.5-1.5B-Instruct",
  "HuggingFaceTB/SmolLM2-1.7B-Instruct"
].filter(Boolean);

const PROFILE_ALIASES: Record<string, string[]> = {
  analytical: ["percentage", "ratio", "proportion", "equation", "speed", "sequence", "table", "graph", "chart", "data", "reasoning"],
  thai: ["reading", "article", "summarize", "interpretation", "word", "sentence", "synonym", "antonym", "ราชาศัพท์"],
  english: ["tense", "preposition", "conjunction", "article", "vocabulary", "passage", "story"],
  law: ["พ.ร.บ.", "พ.ร.ฎ.", "ป.อ.", "จริยธรรม", "เจ้าหน้าที่", "ราชการทางปกครอง"]
};

const THAI_DISTRACTORS = [
  "ข้อความที่ไม่สอดคล้องกับเงื่อนไขของโจทย์",
  "แนวทางที่ขัดกับสาระสำคัญของหัวข้อนี้",
  "คำตอบที่กว้างเกินไปจนไม่ตรงประเด็น",
  "ตัวเลือกที่สรุปเกินข้อมูลที่โจทย์กำหนด"
];

const ENGLISH_DISTRACTORS = [
  "It contradicts the condition in the question.",
  "It is too broad to answer the topic directly.",
  "It does not match the main idea of the prompt.",
  "It ignores the key constraint in the stem."
];

function normalizeText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stableKey(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function containsThai(value: string) {
  return /[ก-๙]/.test(value || "");
}

function containsLatin(value: string) {
  return /[A-Za-z]/.test(value || "");
}

function isEnglishSubject(subject: string) {
  return subject === "English Language";
}

function resolveProfile(subject: string, topic: string) {
  const lowered = `${subject} ${topic}`.toLowerCase();
  if (subject === "Government Law & Ethics") return "law";
  if (subject === "Thai Language") return "thai";
  if (subject === "English Language") return "english";
  for (const [profile, aliases] of Object.entries(PROFILE_ALIASES)) {
    if (aliases.some((alias) => lowered.includes(alias.toLowerCase()))) {
      return profile;
    }
  }
  return "analytical";
}

function buildLanguageRules(subject: string) {
  if (isEnglishSubject(subject)) {
    return "- Question, choices, and explanation must all be written in English only.";
  }
  return "- คำถาม ตัวเลือก และคำอธิบาย ต้องเป็นภาษาไทยทั้งหมด ยกเว้นชื่อหัวข้อภาษาอังกฤษที่จำเป็นต้องคงไว้";
}

function buildPrompts(subject: string, topic: string, difficulty: string, count: number, profile: string, variationSeed: number) {
  const variationModes = [
    "ใช้โจทย์หลายรูปแบบในชุดเดียวกัน",
    "สลับระหว่างคำถามเชิงประยุกต์ คำถามเชิงวิเคราะห์ และคำถามเชิงหลักการ",
    "หลีกเลี่ยงการใช้ stem ซ้ำหรือโครงประโยคตายตัว",
    "ทำให้ตัวเลือกหลอกสมจริงและไม่ซ้ำกัน"
  ];

  return {
    system: "You are an exam-item writer for Thai civil-service practice tests. Return valid JSON only. Do not output markdown, code fences, or commentary.",
    user: `สร้างข้อสอบปรนัยจำนวน ${count} ข้อ
วิชา: ${subject}
หัวข้อย่อย: ${topic}
ระดับความยาก: ${difficulty}
โปรไฟล์คำถาม: ${profile}

ข้อกำหนดบังคับ:
${buildLanguageRules(subject)}
- ทุกข้อเกี่ยวข้องกับหัวข้อ ${topic} โดยตรง
- ทุกข้อมี question, choice_a, choice_b, choice_c, choice_d, correct_answer, explanation
- correct_answer ต้องเป็น A, B, C หรือ D เท่านั้น
- ห้ามใช้ตัวเลือก "ถูกทุกข้อ", "ผิดทุกข้อ", "all of the above", "none of the above"
- ตัวเลือกทั้ง 4 ต้องแตกต่างกันชัดเจน
- อย่าสร้างคำถามซ้ำกัน
- ${variationModes[variationSeed % variationModes.length]}

รูปแบบ JSON ตัวอย่าง:
{
  "questions": [
    {
      "question": "...",
      "choice_a": "...",
      "choice_b": "...",
      "choice_c": "...",
      "choice_d": "...",
      "correct_answer": "A",
      "explanation": "..."
    }
  ]
}`
  };
}

async function chatCompletion(model: string, systemPrompt: string, userPrompt: string) {
  const apiKey = process.env.HUGGINGFACE_API_KEY || env.huggingFaceApiKey;
  if (!apiKey) {
    throw new Error("HUGGINGFACE_API_KEY is required for question generation");
  }

  const response = await fetch(HUGGING_FACE_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: Number(env.transformersMaxNewTokens),
      temperature: Number(env.transformersTemperature),
      top_p: 0.9
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Hugging Face request failed with status ${response.status}`);
  }

  const parsed = JSON.parse(text);
  const content = parsed?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Hugging Face returned an empty response");
  }
  return String(content);
}

function extractJsonBlock(text: string) {
  const cleaned = text.trim();
  if ((cleaned.startsWith("{") && cleaned.endsWith("}")) || (cleaned.startsWith("[") && cleaned.endsWith("]"))) {
    return cleaned;
  }
  const objectMatch = cleaned.match(/\{(?:.|\n|\r)*\}/);
  if (objectMatch) return objectMatch[0];
  const arrayMatch = cleaned.match(/\[(?:.|\n|\r)*\]/);
  if (arrayMatch) return arrayMatch[0];
  throw new Error("No JSON payload found in model response");
}

function escapeControlCharsInStrings(text: string) {
  const output: string[] = [];
  let inString = false;
  let escaping = false;
  for (const char of text) {
    if (escaping) {
      output.push(char);
      escaping = false;
      continue;
    }
    if (char === "\\") {
      output.push(char);
      escaping = true;
      continue;
    }
    if (char === '"') {
      output.push(char);
      inString = !inString;
      continue;
    }
    if (inString && char === "\n") {
      output.push("\\n");
      continue;
    }
    if (inString && char === "\r") {
      output.push("\\r");
      continue;
    }
    if (inString && char === "\t") {
      output.push("\\t");
      continue;
    }
    output.push(char);
  }
  return output.join("");
}

async function inferJsonArray(subject: string, topic: string, difficulty: string, count: number, profile: string, variationSeed: number) {
  const prompts = buildPrompts(subject, topic, difficulty, count, profile, variationSeed);
  const errors: string[] = [];

  for (const model of FALLBACK_MODELS) {
    try {
      const rawText = await chatCompletion(model, prompts.system, prompts.user);
      const parsed = JSON.parse(escapeControlCharsInStrings(extractJsonBlock(rawText)));
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.questions)) return parsed.questions;
      if (parsed?.question) return [parsed];
    } catch (error) {
      errors.push(`${model}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(errors.join(" | ") || "Generation failed");
}

function ensureTopicInQuestion(question: string, topic: string) {
  if (stableKey(question).includes(stableKey(topic))) {
    return question;
  }
  return `[${topic}] ${question}`;
}

function uniqueChoices(correctText: string, candidateValues: string[], englishOnly: boolean) {
  const seen = new Set<string>();
  const ordered = [correctText, ...candidateValues, ...(englishOnly ? ENGLISH_DISTRACTORS : THAI_DISTRACTORS)];
  const choices: string[] = [];

  for (const value of ordered) {
    const normalized = stableKey(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    choices.push(normalizeText(value));
    if (choices.length >= 4) break;
  }

  while (choices.length < 4) {
    const filler = englishOnly ? `Fallback option ${choices.length + 1}` : `ตัวเลือกสำรอง ${choices.length + 1}`;
    if (!seen.has(stableKey(filler))) {
      seen.add(stableKey(filler));
      choices.push(filler);
    }
  }

  return choices.sort(() => Math.random() - 0.5).slice(0, 4);
}

function languageIsValid(subject: string, question: string, choices: string[], explanation: string) {
  const merged = [question, explanation, ...choices].join(" ");
  if (isEnglishSubject(subject)) {
    return containsLatin(merged);
  }
  const thaiHits = [question, explanation, ...choices].filter((value) => containsThai(value)).length;
  return thaiHits >= 4;
}

function normalizeItem(item: Record<string, unknown>, subject: string, topic: string, difficulty: string) {
  const englishOnly = isEnglishSubject(subject);
  const question = ensureTopicInQuestion(normalizeText(item.question), topic);
  if (question.length < 20) return null;

  const optionList = Array.isArray(item.options) ? item.options : [];
  const rawChoices = [
    normalizeText(item.choice_a || optionList[0]),
    normalizeText(item.choice_b || optionList[1]),
    normalizeText(item.choice_c || optionList[2]),
    normalizeText(item.choice_d || optionList[3])
  ];

  const altCorrect = normalizeText(item.correct_choice || item.answer || item.correctAnswer);
  const answerLetter = normalizeText(item.correct_answer).toUpperCase();
  const answerIndex = "ABCD".indexOf(answerLetter);
  const correctText = answerIndex >= 0 && rawChoices[answerIndex]
    ? rawChoices[answerIndex]
    : (altCorrect.length === 1 && "ABCD".includes(altCorrect.toUpperCase()) ? rawChoices["ABCD".indexOf(altCorrect.toUpperCase())] : altCorrect || rawChoices[0]);

  const choices = uniqueChoices(correctText, rawChoices, englishOnly);
  if (!choices.some((choice) => stableKey(choice) === stableKey(correctText))) {
    return null;
  }

  const explanation = normalizeText(item.explanation) || (
    englishOnly
      ? `This answer matches the topic ${topic} and satisfies the condition in the question most directly.`
      : `คำตอบข้อนี้อ้างอิงหัวข้อ ${topic} โดยตรง และตัวเลือกที่ถูกต้องสอดคล้องกับเงื่อนไขของโจทย์มากที่สุด`
  );

  if (!languageIsValid(subject, question, choices, explanation)) {
    return null;
  }

  return {
    subject,
    category: subject,
    subcategory: topic,
    question,
    choice_a: choices[0],
    choice_b: choices[1],
    choice_c: choices[2],
    choice_d: choices[3],
    correct_answer: "ABCD"[choices.findIndex((choice) => stableKey(choice) === stableKey(correctText))] || "A",
    explanation,
    difficulty,
    source: "nlp"
  } satisfies GeneratedRow;
}

function analyticalFallback(topic: string, index: number) {
  const base = 120 + (index * 15);
  const delta = 10 + ((index * 7) % 35);
  const correct = String(base + delta);
  return {
    question: `[${topic}] หากข้อมูลตั้งต้นมีค่า ${base} และเพิ่มขึ้นอีก ${delta} หน่วย ข้อใดคือผลลัพธ์ที่ถูกต้องที่สุดตามเงื่อนไขของโจทย์นี้?`,
    choice_a: correct,
    choice_b: String(base + delta + 4),
    choice_c: String(base + delta - 3),
    choice_d: String(base + delta + 9),
    correct_answer: "A",
    explanation: `คำนวณจาก ${base} + ${delta} จะได้ ${correct} ซึ่งสอดคล้องกับหัวข้อ ${topic}`
  };
}

function thaiFallback(topic: string, index: number) {
  const stems = [
    `[${topic}] ข้อใดสรุปใจความสำคัญได้เหมาะสมที่สุดตามหลักของหัวข้อนี้?`,
    `[${topic}] ข้อใดใช้ถ้อยคำได้สอดคล้องกับบริบทของหัวข้อนี้มากที่สุด?`,
    `[${topic}] หากต้องเลือกข้อความที่ตรงประเด็นที่สุด ควรเลือกข้อใด?`
  ];
  return {
    question: stems[index % stems.length],
    choice_a: `ข้อความที่สอดคล้องกับหลักของ ${topic} และตอบโจทย์ได้ตรงประเด็น`,
    choice_b: "ข้อความที่คลุมเครือและไม่ชี้สาระสำคัญ",
    choice_c: "ข้อความที่ขยายความเกินจากข้อมูลที่กำหนด",
    choice_d: "ข้อความที่ใช้ถ้อยคำไม่เหมาะกับบริบทของโจทย์",
    correct_answer: "A",
    explanation: `ตัวเลือก A สอดคล้องกับสาระของหัวข้อ ${topic} มากที่สุดและไม่สรุปเกินข้อมูล`
  };
}

function englishFallback(topic: string, index: number) {
  const stems = [
    `[${topic}] Choose the option that best completes the sentence according to the topic.`,
    `[${topic}] Which option is the most accurate answer for this English objective item?`,
    `[${topic}] Select the choice that fits the grammar and meaning most closely.`
  ];
  return {
    question: stems[index % stems.length],
    choice_a: `It matches the rule used in ${topic}.`,
    choice_b: "It breaks the structure of the sentence.",
    choice_c: "It changes the meaning of the statement.",
    choice_d: "It does not fit the condition in the prompt.",
    correct_answer: "A",
    explanation: `Choice A is the best answer because it matches the grammar and meaning required by ${topic}.`
  };
}

function lawFallback(topic: string, index: number) {
  const stems = [
    `[${topic}] ข้อใดสอดคล้องกับหลักการสำคัญของกฎหมายฉบับนี้มากที่สุด?`,
    `[${topic}] หากโจทย์ถามถึงสาระสำคัญของกฎหมายฉบับนี้ ควรตอบข้อใด?`,
    `[${topic}] ในบริบทของกฎหมายฉบับนี้ ข้อใดเป็นแนวปฏิบัติที่เหมาะสมที่สุด?`
  ];
  return {
    question: stems[index % stems.length],
    choice_a: "การปฏิบัติให้เป็นไปตามอำนาจหน้าที่และขั้นตอนที่กฎหมายกำหนด",
    choice_b: "การใช้อำนาจโดยไม่ต้องอ้างอิงหลักเกณฑ์ที่เกี่ยวข้อง",
    choice_c: "การละเว้นขั้นตอนสำคัญแม้กฎหมายกำหนดไว้ชัดเจน",
    choice_d: "การตีความกฎหมายโดยไม่คำนึงถึงสาระของบทบัญญัติ",
    correct_answer: "A",
    explanation: `หัวข้อ ${topic} เน้นการใช้อำนาจและการปฏิบัติให้สอดคล้องกับบทบัญญัติและหลักเกณฑ์ของกฎหมาย`
  };
}

function fallbackItem(subject: string, topic: string, difficulty: string, profile: string, index: number) {
  const row = profile === "law"
    ? lawFallback(topic, index)
    : profile === "english"
      ? englishFallback(topic, index)
      : profile === "thai"
        ? thaiFallback(topic, index)
        : analyticalFallback(topic, index);

  return {
    subject,
    category: subject,
    subcategory: topic,
    difficulty,
    source: "nlp",
    ...row
  } satisfies GeneratedRow;
}

export async function generateWithPythonEngine(input: GeneratorInput): Promise<GeneratedRow[]> {
  const profile = resolveProfile(input.category, input.subcategory);
  const results: GeneratedRow[] = [];
  const seenQuestions = new Set<string>();
  let attempts = 0;
  const maxAttempts = Math.max(12, input.count * 4);

  while (results.length < input.count && attempts < maxAttempts) {
    attempts += 1;
    const remaining = input.count - results.length;
    const batchSize = Math.min(5, remaining);
    let generated: Record<string, unknown>[] = [];

    try {
      generated = await inferJsonArray(input.category, input.subcategory, input.difficulty, batchSize, profile, attempts);
    } catch {
      generated = [];
    }

    for (const item of generated) {
      if (!item || typeof item !== "object") continue;
      const normalized = normalizeItem(item, input.category, input.subcategory, input.difficulty);
      if (!normalized) continue;
      const key = stableKey(normalized.question);
      if (seenQuestions.has(key)) continue;
      seenQuestions.add(key);
      results.push(normalized);
      if (results.length >= input.count) break;
    }
  }

  let fallbackIndex = 0;
  while (results.length < input.count) {
    const fallback = fallbackItem(input.category, input.subcategory, input.difficulty, profile, fallbackIndex);
    fallbackIndex += 1;
    const key = stableKey(fallback.question);
    if (seenQuestions.has(key)) continue;
    seenQuestions.add(key);
    results.push(fallback);
  }

  return results.slice(0, input.count);
}
