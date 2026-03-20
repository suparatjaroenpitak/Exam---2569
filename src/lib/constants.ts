import type { ExamCategory, ExamSubcategory, ExamSubject } from "@/lib/types";

export const EXAM_CATEGORIES = ["Analytical Thinking", "Thai Language", "English Language", "Government Law & Ethics"] as const;

export const EXAM_CATEGORY_LABELS: Record<ExamCategory, string> = {
  "Analytical Thinking": "Analytical Thinking",
  "Thai Language": "Thai Language",
  "English Language": "English Language",
  "Government Law & Ethics": "Government Law & Ethics"
};

export const SUBJECT_QUESTION_COUNTS: Record<ExamSubject, number> = {
  "Analytical Thinking": 50,
  "Thai Language": 25,
  "English Language": 25,
  "Government Law & Ethics": 25
};

export const SUBJECT_TIME_LIMIT_MINUTES: Record<ExamSubject, number> = {
  "Analytical Thinking": 60,
  "Thai Language": 30,
  "English Language": 30,
  "Government Law & Ethics": 30
};

export const SUBJECT_SUBCATEGORIES: Record<ExamSubject, readonly ExamSubcategory[]> = {
  "Analytical Thinking": [
    "Percentage",
    "Ratio",
    "Proportion",
    "Equation",
    "Speed Distance Time",
    "Number Comparison",
    "Data Tables",
    "Arithmetic Sequence",
    "Power Sequence",
    "Fraction Sequence",
    "Mixed Sequence",
    "Multi-sequence",
    "Symbolic Conditions",
    "Language Conditions",
    "Relationship Finding",
    "Logical Reasoning",
    "Odd-one-out",
    "Truth Tables",
    "Tables",
    "Graphs",
    "Charts",
    "Data Interpretation"
  ],
  "Thai Language": [
    "Reading Comprehension",
    "Analyze Article",
    "Summarize",
    "Interpretation",
    "Correct Word",
    "Incorrect Word",
    "Thai Royal Vocabulary",
    "Sentence Structure",
    "Conjunction Usage",
    "Complete Sentence",
    "Synonym",
    "Antonym",
    "Word Groups"
  ],
  "English Language": [
    "Tense",
    "Preposition",
    "Conjunction",
    "Article",
    "Vocabulary Synonym",
    "Vocabulary Antonym",
    "Fill in the Blank",
    "Passage Reading",
    "Story Questions"
  ],
  "Government Law & Ethics": [
    "พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน 2534",
    "พ.ร.ฎ.วิธีการบริหารกิจการบ้านเมืองที่ดี 2546",
    "พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539",
    "ป.อ.2499 (ในส่วนความผิดต่อตำแหน่งหน้าที่ราชการ)",
    "พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่",
    "พ.ร.บ.มาตราฐานทางจริยธรรม 2562"
  ]
};

export const EXAM_LENGTH_OPTIONS = [10, 25, 50, 100] as const;
export const DIFFICULTY_OPTIONS = ["easy", "medium", "hard"] as const;
export const EXCEL_SHEETS = {
  questions: "questions",
  users: "users",
  history: "history"
} as const;

const SUBJECT_ALIASES: Record<string, ExamSubject> = {
  Mathematics: "Analytical Thinking",
  English: "English Language",
  "Thai Law": "Government Law & Ethics",
  "Thai Language": "Thai Language",
  "Analytical Thinking": "Analytical Thinking",
  "English Language": "English Language",
  "Government Law & Ethics": "Government Law & Ethics",
  // short codes produced by the import/generation pipeline
  math: "Analytical Thinking",
  thai: "Thai Language",
  english: "English Language",
  law: "Government Law & Ethics"
};

export function normalizeSubject(value: string): ExamSubject | null {
  if (!value) return null;
  const key = value.trim();
  // try exact match first, then lowercase match
  return SUBJECT_ALIASES[key] ?? SUBJECT_ALIASES[key.toLowerCase()] ?? null;
}

export function getSubjectSubcategories(subject: ExamSubject) {
  return SUBJECT_SUBCATEGORIES[subject];
}

export function isSupportedSubcategory(subject: ExamSubject, subcategory: string): subcategory is ExamSubcategory {
  return SUBJECT_SUBCATEGORIES[subject].includes(subcategory as ExamSubcategory);
}

export function getDefaultSubcategory(subject: ExamSubject): ExamSubcategory {
  return SUBJECT_SUBCATEGORIES[subject][0];
}

export function getExamDurationSeconds(subject: ExamSubject, count: number) {
  const configuredCount = SUBJECT_QUESTION_COUNTS[subject];
  const configuredMinutes = SUBJECT_TIME_LIMIT_MINUTES[subject];
  const secondsPerQuestion = (configuredMinutes * 60) / configuredCount;
  return Math.max(60, Math.round(count * secondsPerQuestion));
}
