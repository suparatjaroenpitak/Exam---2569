export type Locale = "en" | "th";
export type ThemeMode = "light" | "dark";

import en from "./en.json";
import th from "./th.json";

import type { ExamCategory, ExamSubcategory, QuestionDifficulty } from "@/lib/types";

const MAP: Record<Locale, Record<string, string>> = {
  en,
  th
};

export type TranslationKey = string;

const CATEGORY_KEYS: Record<ExamCategory, TranslationKey> = {
  "Analytical Thinking": "category.analytical-thinking",
  "Thai Language": "category.thai-language",
  "English Language": "category.english-language",
  "Government Law & Ethics": "category.government-law-ethics"
};

const SUBCATEGORY_KEYS: Partial<Record<ExamSubcategory, TranslationKey>> = {
  Percentage: "subcategory.percentage",
  Ratio: "subcategory.ratio",
  Proportion: "subcategory.proportion",
  Equation: "subcategory.equation",
  "Speed Distance Time": "subcategory.speed-distance-time",
  "Number Comparison": "subcategory.number-comparison",
  "Data Tables": "subcategory.data-tables",
  "Arithmetic Sequence": "subcategory.arithmetic-sequence",
  "Power Sequence": "subcategory.power-sequence",
  "Fraction Sequence": "subcategory.fraction-sequence",
  "Mixed Sequence": "subcategory.mixed-sequence",
  "Multi-sequence": "subcategory.multi-sequence",
  "Symbolic Conditions": "subcategory.symbolic-conditions",
  "Language Conditions": "subcategory.language-conditions",
  "Relationship Finding": "subcategory.relationship-finding",
  "Logical Reasoning": "subcategory.logical-reasoning",
  "Odd-one-out": "subcategory.odd-one-out",
  "Truth Tables": "subcategory.truth-tables",
  Tables: "subcategory.tables",
  Graphs: "subcategory.graphs",
  Charts: "subcategory.charts",
  "Data Interpretation": "subcategory.data-interpretation",
  "Reading Comprehension": "subcategory.reading-comprehension",
  "Analyze Article": "subcategory.analyze-article",
  Summarize: "subcategory.summarize",
  Interpretation: "subcategory.interpretation",
  "Correct Word": "subcategory.correct-word",
  "Incorrect Word": "subcategory.incorrect-word",
  "Thai Royal Vocabulary": "subcategory.thai-royal-vocabulary",
  "Sentence Structure": "subcategory.sentence-structure",
  "Conjunction Usage": "subcategory.conjunction-usage",
  "Complete Sentence": "subcategory.complete-sentence",
  Synonym: "subcategory.synonym",
  Antonym: "subcategory.antonym",
  "Word Groups": "subcategory.word-groups",
  Tense: "subcategory.tense",
  Preposition: "subcategory.preposition",
  Conjunction: "subcategory.conjunction",
  Article: "subcategory.article",
  "Vocabulary Synonym": "subcategory.vocabulary-synonym",
  "Vocabulary Antonym": "subcategory.vocabulary-antonym",
  "Fill in the Blank": "subcategory.fill-in-the-blank",
  "Passage Reading": "subcategory.passage-reading",
  "Story Questions": "subcategory.story-questions",
  "พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน 2534": "subcategory.state-administration-act-2534",
  "พ.ร.ฎ.วิธีการบริหารกิจการบ้านเมืองที่ดี 2546": "subcategory.good-governance-decree-2546",
  "พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539": "subcategory.administrative-procedure-act-2539",
  "ป.อ.2499 (ในส่วนความผิดต่อตำแหน่งหน้าที่ราชการ)": "subcategory.criminal-code-2499-offences-of-office",
  "พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่": "subcategory.official-liability-and-tort",
  "พ.ร.บ.มาตราฐานทางจริยธรรม 2562": "subcategory.ethical-standards-act-2562"
};

const DIFFICULTY_KEYS: Record<QuestionDifficulty, TranslationKey> = {
  easy: "difficulty.easy",
  medium: "difficulty.medium",
  hard: "difficulty.hard"
};

const API_MESSAGE_KEYS: Record<string, TranslationKey> = {
  "PDF imported successfully": "message.pdf-import-success",
  "Please choose a PDF file": "message.pdf-select-file",
  "Import failed": "message.import-failed",
  "Generation failed": "message.generation-failed",
  "Unable to create exam": "message.exam-create-failed",
  "Request failed": "message.request-failed",
  "Invalid import payload": "message.invalid-import-payload",
  "No valid questions were parsed from the PDF": "message.no-valid-pdf-questions",
  "PDF import failed": "message.pdf-import-failed",
  "Missing OPENAI_API_KEY configuration": "message.request-failed",
  "AI generation failed": "message.generation-failed",
  "Unable to submit exam": "message.exam-submit-failed"
};

export function t(locale: Locale, key: TranslationKey | string, defaultText?: string) {
  return MAP[locale][key as TranslationKey] ?? defaultText ?? key;
}

export function getCategoryLabel(locale: Locale, category: ExamCategory) {
  return t(locale, CATEGORY_KEYS[category], category);
}

export function getSubcategoryLabel(locale: Locale, subcategory: ExamSubcategory | "all") {
  if (subcategory === "all") {
    return t(locale, "common.all", "All");
  }

  const key = SUBCATEGORY_KEYS[subcategory];
  return key ? t(locale, key, subcategory) : subcategory;
}

export function getDifficultyLabel(locale: Locale, difficulty: QuestionDifficulty) {
  return t(locale, DIFFICULTY_KEYS[difficulty], difficulty);
}

export function translateApiMessage(locale: Locale, message: string) {
  const key = API_MESSAGE_KEYS[message];
  return key ? t(locale, key, message) : message;
}

export function getIntlLocale(locale: Locale) {
  return locale === "th" ? "th-TH" : "en-US";
}
