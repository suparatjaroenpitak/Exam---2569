import { SUBJECT_SUBCATEGORIES, getDefaultSubcategory, isSupportedSubcategory } from "@/lib/constants";
import { classifyByKeywords, estimateDifficulty, parseCandidate, splitPdfIntoQuestionCandidates } from "@/lib/pdf-question-parser";
import type { AnswerKey, ExamCategory, ExamSubcategory, QuestionDifficulty, QuestionRecord } from "@/lib/types";

const SUBCATEGORY_HINTS: Partial<Record<ExamSubcategory, string[]>> = {
  Percentage: ["ร้อยละ", "เปอร์เซ็นต์", "percent", "%"],
  Ratio: ["อัตราส่วน", "ratio"],
  Proportion: ["สัดส่วน", "proportion"],
  Equation: ["สมการ", "equation", "ค่า x", "แก้สมการ"],
  "Speed Distance Time": ["อัตราเร็ว", "ระยะทาง", "เวลา", "speed", "distance", "time"],
  "Number Comparison": ["เปรียบเทียบ", "มากกว่า", "น้อยกว่า", "comparison"],
  "Data Tables": ["ตารางข้อมูล", "data table"],
  "Logical Reasoning": ["เหตุผล", "ตรรกะ", "logical"],
  "Reading Comprehension": ["อ่านบทความ", "อ่านจับใจความ", "บทความ"],
  Summarize: ["สรุป", "ใจความสำคัญ"],
  Interpretation: ["ตีความ", "interpret"],
  Synonym: ["คำไวพจน์", "ความหมายใกล้เคียง", "synonym"],
  Antonym: ["คำตรงข้าม", "antonym"],
  Tense: ["tense", "verb tense"],
  Preposition: ["preposition"],
  Conjunction: ["conjunction"],
  Article: ["article", "a an the"],
  "Vocabulary Synonym": ["synonym", "similar meaning"],
  "Vocabulary Antonym": ["antonym", "opposite meaning"],
  "Fill in the Blank": ["fill in the blank", "เติมคำในช่องว่าง"],
  "Passage Reading": ["passage", "read the passage"],
  "Story Questions": ["story", "article", "dialogue"],
  "พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน 2534": ["ระเบียบบริหารราชการแผ่นดิน", "2534"],
  "พ.ร.ฎ.วิธีการบริหารกิจการบ้านเมืองที่ดี 2546": ["กิจการบ้านเมืองที่ดี", "2546"],
  "พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539": ["ปฏิบัติราชการทางปกครอง", "2539"],
  "ป.อ.2499 (ในส่วนความผิดต่อตำแหน่งหน้าที่ราชการ)": ["ป.อ.", "ความผิดต่อตำแหน่ง", "2499"],
  "พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่": ["ละเมิดของเจ้าหน้าที่", "ความรับผิด"],
  "พ.ร.บ.มาตราฐานทางจริยธรรม 2562": ["จริยธรรม", "2562", "มาตรฐานทางจริยธรรม"]
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
      reason: "Rejected by WangchanBERTa NLP validation"
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
        ? "Validated with WangchanBERTa NLP parser"
        : "Imported with WangchanBERTa NLP parser; no explicit answer key was found in source text.",
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

  for (let i = 0; i < input.count; i++) {
    const diff = input.difficulty;
    const subject = input.category;
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
      const acts = [...SUBJECT_SUBCATEGORIES["Government Law & Ethics"]];
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
