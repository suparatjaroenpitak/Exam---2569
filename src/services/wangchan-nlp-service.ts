import { SUBJECT_SUBCATEGORIES, getDefaultSubcategory, isSupportedSubcategory } from "@/lib/constants";
import { env } from "@/lib/env";
import { classifyByKeywords, estimateDifficulty, parseCandidate, splitPdfIntoQuestionCandidates } from "@/lib/pdf-question-parser";
import type { AnswerKey, ExamCategory, ExamSubcategory, QuestionDifficulty, QuestionRecord } from "@/lib/types";
import { generateWithPythonEngine } from "@/services/python-ai-service";

const THAI_GENERATOR_NAME = "Mistral AI";

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

function buildRowStemFingerprint(row: Pick<QuestionRecord, "subject" | "subcategory" | "question">) {
  const subject = normalizeText(row.subject).toLowerCase();
  const subcategory = normalizeText(row.subcategory).toLowerCase();
  const question = normalizeText(row.question).toLowerCase();

  return [subject, subcategory, question].join("||");
}

function pickOne<T>(items: readonly T[]) {
  return items[randInt(0, items.length - 1)];
}

const LAW_CONCEPTS: Record<Extract<ExamSubcategory,
  | "พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน 2534"
  | "พ.ร.ฎ.วิธีการบริหารกิจการบ้านเมืองที่ดี 2546"
  | "พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539"
  | "ป.อ.2499 (ในส่วนความผิดต่อตำแหน่งหน้าที่ราชการ)"
  | "พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่"
  | "พ.ร.บ.มาตราฐานทางจริยธรรม 2562"
>, Array<{ clue: string; explanation: string }>> = {
  "พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน 2534": [
    { clue: "การจัดโครงสร้างราชการส่วนกลาง ส่วนภูมิภาค และส่วนท้องถิ่น", explanation: "กฎหมายนี้ว่าด้วยโครงสร้างและระบบบริหารราชการแผ่นดิน" },
    { clue: "อำนาจหน้าที่ของคณะรัฐมนตรี นายกรัฐมนตรี และกระทรวงทบวงกรม", explanation: "สาระสำคัญของกฎหมายนี้คือการกำหนดอำนาจหน้าที่ขององค์กรฝ่ายบริหาร" },
    { clue: "หลักการจัดระเบียบบริหารราชการแผ่นดิน", explanation: "หัวใจของกฎหมายฉบับนี้คือระเบียบและโครงสร้างการบริหารราชการ" },
    { clue: "ความสัมพันธ์ในการบังคับบัญชาระหว่างส่วนราชการ", explanation: "กฎหมายนี้กำหนดสายการบังคับบัญชาในระบบราชการ" },
    { clue: "การแบ่งส่วนราชการและการมอบอำนาจในระบบราชการ", explanation: "เนื้อหาครอบคลุมการแบ่งส่วนราชการและการมอบอำนาจตามระบบบริหารราชการแผ่นดิน" }
  ],
  "พ.ร.ฎ.วิธีการบริหารกิจการบ้านเมืองที่ดี 2546": [
    { clue: "การบริหารงานเพื่อประโยชน์สุขของประชาชน", explanation: "กฎหมายนี้เน้นหลักธรรมาภิบาลและประโยชน์สุขของประชาชน" },
    { clue: "การลดขั้นตอนการปฏิบัติงานและการอำนวยความสะดวกแก่ประชาชน", explanation: "สาระสำคัญคือการทำงานภาครัฐให้มีประสิทธิภาพและบริการประชาชนดีขึ้น" },
    { clue: "การประเมินผลสัมฤทธิ์ของภารกิจภาครัฐ", explanation: "กฎหมายนี้กำหนดให้ส่วนราชการบริหารแบบมุ่งผลสัมฤทธิ์" },
    { clue: "หลักความคุ้มค่าและความโปร่งใสในการบริหารราชการ", explanation: "แนวคิดหลักคือการบริหารกิจการบ้านเมืองที่ดีอย่างคุ้มค่าและโปร่งใส" },
    { clue: "การพัฒนาคุณภาพการให้บริการภาครัฐ", explanation: "เป้าหมายสำคัญคือยกระดับคุณภาพบริการของรัฐ" }
  ],
  "พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539": [
    { clue: "การออกคำสั่งทางปกครอง", explanation: "กฎหมายนี้กำหนดหลักและขั้นตอนเกี่ยวกับคำสั่งทางปกครอง" },
    { clue: "สิทธิของคู่กรณีในการรับฟังพยานหลักฐาน", explanation: "สาระสำคัญคือคุ้มครองสิทธิของคู่กรณีในกระบวนการทางปกครอง" },
    { clue: "การเพิกถอนหรือแก้ไขคำสั่งทางปกครอง", explanation: "กฎหมายนี้วางหลักเกี่ยวกับผลและการเพิกถอนคำสั่งทางปกครอง" },
    { clue: "การแจ้งเหตุผลของคำสั่งทางปกครอง", explanation: "หลักสำคัญคือเจ้าหน้าที่ต้องแจ้งเหตุผลในคำสั่งตามที่กฎหมายกำหนด" },
    { clue: "ขั้นตอนปฏิบัติของเจ้าหน้าที่ในเรื่องทางปกครอง", explanation: "กฎหมายนี้กำหนดวิธีปฏิบัติราชการทางปกครองอย่างเป็นธรรม" }
  ],
  "ป.อ.2499 (ในส่วนความผิดต่อตำแหน่งหน้าที่ราชการ)": [
    { clue: "เจ้าพนักงานใช้อำนาจหน้าที่โดยมิชอบ", explanation: "บทบัญญัติส่วนนี้ว่าด้วยความผิดของเจ้าพนักงานต่อตำแหน่งหน้าที่ราชการ" },
    { clue: "การเรียกรับทรัพย์สินหรือประโยชน์โดยมิชอบ", explanation: "สาระสำคัญครอบคลุมความผิดเกี่ยวกับการทุจริตของเจ้าพนักงาน" },
    { clue: "การปฏิบัติหรือละเว้นการปฏิบัติหน้าที่โดยทุจริต", explanation: "กฎหมายนี้ลงโทษการใช้อำนาจหน้าที่โดยทุจริต" },
    { clue: "ความรับผิดทางอาญาของเจ้าพนักงาน", explanation: "เนื้อหามุ่งคุ้มครองความสุจริตในการใช้อำนาจรัฐ" },
    { clue: "ความผิดเกี่ยวกับตำแหน่งหน้าที่ของเจ้าพนักงาน", explanation: "เป็นบทบัญญัติว่าด้วยความผิดต่อตำแหน่งหน้าที่ราชการ" }
  ],
  "พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่": [
    { clue: "ความรับผิดของหน่วยงานของรัฐจากการกระทำละเมิดของเจ้าหน้าที่", explanation: "กฎหมายนี้กำหนดหลักความรับผิดจากละเมิดของเจ้าหน้าที่" },
    { clue: "การไล่เบี้ยเจ้าหน้าที่เมื่อจงใจหรือประมาทเลินเล่ออย่างร้ายแรง", explanation: "สาระสำคัญคือหลักการชดใช้และการไล่เบี้ย" },
    { clue: "การชดใช้ค่าสินไหมทดแทนจากความเสียหายที่เกิดแก่เอกชน", explanation: "กฎหมายนี้วางหลักให้หน่วยงานรัฐรับผิดชอบต่อผู้เสียหาย" },
    { clue: "เงื่อนไขการเรียกให้เจ้าหน้าที่รับผิดเป็นการส่วนตัว", explanation: "ประเด็นหลักคือเกณฑ์ความรับผิดส่วนบุคคลของเจ้าหน้าที่" },
    { clue: "หลักเกณฑ์เมื่อเจ้าหน้าที่กระทำละเมิดในระหว่างปฏิบัติหน้าที่", explanation: "กฎหมายนี้ใช้กับการละเมิดที่เกิดขึ้นระหว่างปฏิบัติหน้าที่ราชการ" }
  ],
  "พ.ร.บ.มาตราฐานทางจริยธรรม 2562": [
    { clue: "มาตรฐานจริยธรรมของเจ้าหน้าที่ของรัฐ", explanation: "กฎหมายนี้กำหนดมาตรฐานทางจริยธรรมสำหรับเจ้าหน้าที่ของรัฐ" },
    { clue: "ค่านิยมด้านความซื่อสัตย์สุจริตและความรับผิดชอบ", explanation: "สาระสำคัญคือหลักจริยธรรมและคุณธรรมในการดำรงตน" },
    { clue: "กลไกกำกับดูแลการประพฤติทางจริยธรรม", explanation: "กฎหมายนี้วางกรอบการกำกับดูแลมาตรฐานจริยธรรม" },
    { clue: "หลักปฏิบัติเพื่อประโยชน์ส่วนรวมและหลีกเลี่ยงผลประโยชน์ทับซ้อน", explanation: "หัวใจคือการคุ้มครองประโยชน์สาธารณะและป้องกันผลประโยชน์ทับซ้อน" },
    { clue: "การยึดมั่นในจริยธรรมของผู้ดำรงตำแหน่งของรัฐ", explanation: "กฎหมายนี้ใช้เป็นมาตรฐานทางจริยธรรมของผู้ปฏิบัติงานภาครัฐ" }
  ]
};

function createLawQuestion(input: {
  subcategory: Extract<ExamSubcategory,
    | "พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน 2534"
    | "พ.ร.ฎ.วิธีการบริหารกิจการบ้านเมืองที่ดี 2546"
    | "พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539"
    | "ป.อ.2499 (ในส่วนความผิดต่อตำแหน่งหน้าที่ราชการ)"
    | "พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่"
    | "พ.ร.บ.มาตราฐานทางจริยธรรม 2562"
  >;
  difficulty: QuestionDifficulty;
}) {
  const acts = [...SUBJECT_SUBCATEGORIES["Government Law & Ethics"]];
  const concept = pickOne(LAW_CONCEPTS[input.subcategory]);
  const stemTemplates = [
    `ข้อใดเป็นสาระสำคัญของ ${input.subcategory}?`,
    `หากโจทย์กล่าวถึง "${concept.clue}" ข้อสอบนั้นควรอยู่ภายใต้กฎหมายใด?`,
    `ประเด็น "${concept.clue}" สัมพันธ์กับกฎหมายฉบับใดมากที่สุด?`,
    `ข้อใดกล่าวถึง ${input.subcategory} ได้ถูกต้องที่สุด?`,
    `ถ้าหน่วยงานรัฐต้องพิจารณาเรื่อง "${concept.clue}" ควรอ้างอิงกฎหมายใด?`
  ];
  const question = pickOne(stemTemplates);
  const correct = input.subcategory;
  const wrongs = shuffle(acts.filter((act) => act !== correct)).slice(0, 3);
  const choices = shuffle([correct, ...wrongs]);

  return {
    question,
    choices,
    correct,
    explanation: `${concept.explanation} จึงเข้ากับ ${input.subcategory}`
  };
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

async function callMistralModel(input: {
  category: ExamCategory;
  subcategory: ExamSubcategory;
  count: number;
  difficulty: QuestionDifficulty;
}) {
  const prompt = buildGenerationPrompt(input);
  const url = `${env.mistralBaseUrl.replace(/\/$/, "")}/${env.mistralModel}`;

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
        temperature: 0.9,
        top_p: 0.95,
        max_new_tokens: Math.max(900, input.count * 220)
      },
      options: { wait_for_model: true }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = typeof payload?.error === "string"
      ? payload.error
      : payload?.error?.message || payload?.message || `Mistral model request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (Array.isArray(payload) && typeof payload[0]?.generated_text === "string") {
    return payload[0].generated_text as string;
  }

  if (typeof payload?.generated_text === "string") {
    return payload.generated_text as string;
  }

  throw new Error("Mistral generative model returned an unsupported response shape");
}

async function generateQuestionsWithMistralModel(input: {
  category: ExamCategory;
  subcategory: ExamSubcategory;
  count: number;
  difficulty: QuestionDifficulty;
}) {
  try {
    const generatedText = await callMistralModel(input);
    try {
      const jsonPayload = extractJsonPayload(generatedText);
      return normalizeGeneratedRows(input, JSON.parse(jsonPayload)).slice(0, input.count);
    } catch (_) {
      return [];
    }
  } catch (_) {
    return [];
  }
}

function normalizeGeneratedRows(
  input: { category: ExamCategory; subcategory: ExamSubcategory; difficulty: QuestionDifficulty },
  rawRows: unknown
): any[] {
  const rowsArray = Array.isArray(rawRows)
    ? rawRows
    : rawRows && typeof rawRows === "object" && Array.isArray((rawRows as { questions?: unknown[] }).questions)
      ? (rawRows as { questions: unknown[] }).questions
      : [];

  const seen = new Set<string>();
  const seenStemFingerprints = new Set<string>();

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
    const inferred = inferSubcategory(input.category, `${question}\n${choices.join("\n")}`);

    // Prefer explicit subcategory returned by the model when available and valid.
    const recordSubRaw = normalizeText(record.subcategory || record.category || "");
    const recordSub = recordSubRaw && isSupportedSubcategory(input.category, recordSubRaw) ? recordSubRaw : null;

    // Determine candidate subcategory: prefer explicit model-provided, otherwise inference
    let subcategoryCandidate: string | null = null;
    if (recordSub) {
      subcategoryCandidate = recordSub;
    } else {
      subcategoryCandidate = inferred;
    }

    // If a specific subcategory was requested, enforce it strictly: candidate must equal requested
    if (isSupportedSubcategory(input.category, input.subcategory) && subcategoryCandidate !== input.subcategory) {
        // Log rejected candidate for diagnostics so we can analyze model failures
        try {
          const debugPath = (globalThis?.process && globalThis.process.cwd)
            ? require("path").join(globalThis.process.cwd(), "data", "generation_debug.json")
            : null;
          if (debugPath) {
            const fs = require("fs");
            let logs = [];
            try {
              if (fs.existsSync(debugPath)) logs = JSON.parse(fs.readFileSync(debugPath, "utf8") || "[]");
            } catch (e) {
              logs = [];
            }
            logs.push({ ts: new Date().toISOString(), requested: input.subcategory, model_subcategory: recordSub, inferred, question, choices, reason: "subcategory-mismatch" });
            try { fs.writeFileSync(debugPath, JSON.stringify(logs.slice(-500), null, 2), "utf8"); } catch (e) {}
          }
        } catch (e) {
          // ignore logging failures
        }
        return [];
      }

      const subcategory = subcategoryCandidate as ExamSubcategory;

    const normalizedRow = {
      subject: input.category,
      category: input.category,
      subcategory,
      model_subcategory: recordSub || "",
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
    const stemFingerprint = buildRowStemFingerprint(normalizedRow);
    if (seen.has(fingerprint) || seenStemFingerprints.has(stemFingerprint)) {
      return [];
    }
    seen.add(fingerprint);
    seenStemFingerprints.add(stemFingerprint);
    return [normalizedRow];
  });
}

async function generateQuestionsWithThaiModel(input: {
  category: ExamCategory;
  subcategory: ExamSubcategory;
  count: number;
  difficulty: QuestionDifficulty;
}) {
  // Call the Thai model and attempt to extract JSON. If parsing fails or the
  // model call errors, return an empty array so the caller can retry.
  try {
    const generatedText = await callThaiGenerativeModel(input);
    try {
      const jsonPayload = extractJsonPayload(generatedText);
      return normalizeGeneratedRows(input, JSON.parse(jsonPayload)).slice(0, input.count);
    } catch (parseErr) {
      // Save raw output for debugging and return empty so caller can retry.
      try {
        const debugPath = (globalThis?.process && globalThis.process.cwd)
          ? require("path").join(globalThis.process.cwd(), "data", "generation_debug.json")
          : null;
        if (debugPath) {
          const fs = require("fs");
          let logs: any[] = [];
          try {
            if (fs.existsSync(debugPath)) logs = JSON.parse(fs.readFileSync(debugPath, "utf8") || "[]");
          } catch (_) { logs = []; }
          logs.push({ ts: new Date().toISOString(), requested: input.subcategory, error: String(parseErr), raw: generatedText });
          try { fs.writeFileSync(debugPath, JSON.stringify(logs.slice(-1000), null, 2), "utf8"); } catch (_) {}
        }
      } catch (_) {
        // ignore logging failures
      }
      return [];
    }
  } catch (_) {
    return [];
  }
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
  allowTemplateFallback?: boolean;
}): Promise<Array<Omit<QuestionRecord, "id" | "createdAt">>> {
  const collected: Array<Omit<QuestionRecord, "id" | "createdAt">> = [];
  const seenFingerprints = new Set<string>();
  const seenStemFingerprints = new Set<string>();

  const appendUnique = (rows: Array<Omit<QuestionRecord, "id" | "createdAt">>) => {
    for (const row of rows) {
      const fingerprint = buildRowFingerprint(row);
      const stemFingerprint = buildRowStemFingerprint(row);
      if (seenFingerprints.has(fingerprint) || seenStemFingerprints.has(stemFingerprint)) {
        continue;
      }

      seenFingerprints.add(fingerprint);
      seenStemFingerprints.add(stemFingerprint);
      collected.push(row);

      if (collected.length >= input.count) {
        break;
      }
    }
  };

  // Try multiple model attempts to get enough items in the requested subcategory.
  const maxModelAttempts = 5;
  for (let attempt = 0; attempt < maxModelAttempts && collected.length < input.count; attempt++) {
    try {
      const rows = await generateQuestionsWithThaiModel(input);
      appendUnique(rows);
    } catch (e) {
      // If model call fails or parsing failed, continue to next attempt so we can retry
      continue;
    }
  }

  // If still short, try Mistral AI as a secondary fallback (if configured).
  if (collected.length < input.count) {
    for (let attempt = 0; attempt < maxModelAttempts && collected.length < input.count; attempt++) {
      try {
        const rows = await generateQuestionsWithMistralModel(input);
        appendUnique(rows);
      } catch (e) {
        continue;
      }
    }
  }

  // If still short, optionally fall back to local templates.
  if ((input.allowTemplateFallback ?? true) && collected.length < input.count) {
    appendUnique(await generateQuestionsWithTemplates({
      ...input,
      count: input.count - collected.length
    }));
  }

  return collected;
}

// AI extraction fallback: given raw PDF text, ask Mistral to extract MCQs as JSON.
export async function aiExtractQuestionsFromText(rawText: string, options?: { maxQuestions?: number }) {
  const count = options?.maxQuestions ?? 50;
  const prompt = [
    "You are an expert Thai exam parser. Extract multiple-choice questions from the following Thai exam text.",
    "Return JSON only. The output must be an array of objects with fields: question, choice_a, choice_b, choice_c, choice_d (if available), correct_answer (A/B/C/D optional), subcategory (optional).",
    "If choices are fewer than 4, include the choices you can detect. Do not invent choices.",
    "If you cannot extract questions, return an empty array.",
    "Text:",
    rawText
  ].join("\n\n");

  // reuse callThaiGenerativeModel by wrapping the prompt
  // callThaiGenerativeModel expects category/subcategory inputs; instead call the raw endpoint directly
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
        temperature: 0.7,
        top_p: 0.9,
        max_new_tokens: Math.max(600, count * 150)
      },
      options: { wait_for_model: true }
    })
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || payload?.message || `Model error ${response.status}`);
  const raw = Array.isArray(payload) && payload[0]?.generated_text ? payload[0].generated_text : payload.generated_text;
  if (!raw || typeof raw !== "string") return [];

  // extract JSON
  try {
    const json = JSON.parse(extractJsonPayload(raw));
    if (!Array.isArray(json)) return [];
    // normalize items
    return json.map((item: any) => ({
      subject: "Analytical Thinking" as any,
      category: "Analytical Thinking" as any,
      subcategory: item.subcategory || "",
      difficulty: "medium" as QuestionDifficulty,
      question: String(item.question || "").trim(),
      choice_a: String(item.choice_a || "").trim(),
      choice_b: String(item.choice_b || "").trim(),
      choice_c: String(item.choice_c || "").trim(),
      choice_d: String(item.choice_d || "").trim(),
      correct_answer: String(item.correct_answer || "").toUpperCase() as any,
      explanation: String(item.explanation || "").trim(),
      source: "nlp" as const,
      model_subcategory: item.subcategory || ""
    }));
  } catch (e) {
    return [];
  }
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
  const seenStemFingerprints = new Set<string>();
  const maxAttempts = Math.max(50, input.count * 6);
  let attempts = 0;

  while (rows.length < input.count && attempts < maxAttempts) {
    attempts++;
    const diff = input.difficulty;
    const subject = input.category;
    let question = "";
    let choices: string[] = [];
    let correct = "";
    let explanation = "";

    if (subject === "Analytical Thinking") {
      const a = randInt(2, diff === "easy" ? 12 : diff === "medium" ? 30 : 120);
      const b = randInt(1, diff === "easy" ? 10 : diff === "medium" ? 20 : 60);
      const op = Math.random() < 0.5 ? "+" : "-";
      question = `หาก ${a} ${op} x = ${a + (op === "+" ? b : -b)}, ค่า x เท่ากับเท่าใด?`;
      correct = op === "+" ? String(b) : String(-b);
      const wrongs = [String(b + 1), String(Math.max(1, b - 1)), String(b + 2)];
      choices = shuffle([correct, ...wrongs]);
      explanation = `แก้สมการให้ได้ค่า x = ${correct}`;
    } else if (subject === "Thai Language") {
      const words = ["ความหมาย", "คำศัพท์", "ประโยค", "การอ่าน", "การสะกด"];
      const target = words[randInt(0, words.length - 1)];
      question = `คำใดมีความหมายใกล้เคียงกับ "${target}" มากที่สุด?`;
      correct = target;
      const wrongs = shuffle(words.filter((w) => w !== target)).slice(0, 3);
      choices = shuffle([correct, ...wrongs]);
      explanation = `คำที่ใกล้เคียงกับ "${correct}" คือ "${correct}"`;
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
      explanation = `Synonym of ${pair[0]} is ${correct}`;
    } else {
      // If the admin requested a specific subcategory (act) and it's supported,
      // use it consistently for generated questions instead of picking randomly.
      const requestedAct = isSupportedSubcategory("Government Law & Ethics", input.subcategory)
        ? input.subcategory
        : null;
      const act = (requestedAct ?? getDefaultSubcategory("Government Law & Ethics")) as Extract<ExamSubcategory,
        | "พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน 2534"
        | "พ.ร.ฎ.วิธีการบริหารกิจการบ้านเมืองที่ดี 2546"
        | "พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539"
        | "ป.อ.2499 (ในส่วนความผิดต่อตำแหน่งหน้าที่ราชการ)"
        | "พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่"
        | "พ.ร.บ.มาตราฐานทางจริยธรรม 2562"
      >;
      const lawQuestion = createLawQuestion({ subcategory: act, difficulty: diff });
      question = lawQuestion.question;
      correct = lawQuestion.correct;
      choices = lawQuestion.choices;
      explanation = lawQuestion.explanation;
    }

    // normalize and build fingerprint similar to question-service
    const qNorm = String(question).replace(/\s+/g, " ").trim().toLowerCase();
    const choiceNorms = choices.map((c) => String(c).replace(/\s+/g, " ").trim().toLowerCase());
    const sortedChoices = choiceNorms.slice().sort();
    const keyMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    const correctIndex = choices.indexOf(correct);
    const correctText = correctIndex >= 0 ? choiceNorms[correctIndex] : "";
    const fingerprint = [qNorm, sortedChoices.join("||"), correctText].join("||");
    const stemFingerprint = [subject.toLowerCase(), String(input.subcategory).toLowerCase(), qNorm].join("||");

    if (seenFingerprints.has(fingerprint) || seenStemFingerprints.has(stemFingerprint)) {
      continue;
    }

    seenFingerprints.add(fingerprint);
    seenStemFingerprints.add(stemFingerprint);

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
      correct_answer: correctKey || "A",
      explanation,
      difficulty: diff,
      source: "llm"
    });
  }

  return rows;
}
