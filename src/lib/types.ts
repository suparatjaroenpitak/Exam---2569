export type UserRole = "admin" | "user";
export type ExamSubject = "Analytical Thinking" | "Thai Language" | "English Language" | "Government Law & Ethics";
export type ExamCategory = ExamSubject;
export type ExamSubcategory =
  | "Percentage"
  | "Ratio"
  | "Proportion"
  | "Equation"
  | "Speed Distance Time"
  | "Number Comparison"
  | "Data Tables"
  | "Arithmetic Sequence"
  | "Power Sequence"
  | "Fraction Sequence"
  | "Mixed Sequence"
  | "Multi-sequence"
  | "Symbolic Conditions"
  | "Language Conditions"
  | "Relationship Finding"
  | "Logical Reasoning"
  | "Odd-one-out"
  | "Truth Tables"
  | "Tables"
  | "Graphs"
  | "Charts"
  | "Data Interpretation"
  | "Reading Comprehension"
  | "Analyze Article"
  | "Summarize"
  | "Interpretation"
  | "Correct Word"
  | "Incorrect Word"
  | "Thai Royal Vocabulary"
  | "Sentence Structure"
  | "Conjunction Usage"
  | "Complete Sentence"
  | "Synonym"
  | "Antonym"
  | "Word Groups"
  | "Tense"
  | "Preposition"
  | "Conjunction"
  | "Article"
  | "Vocabulary Synonym"
  | "Vocabulary Antonym"
  | "Fill in the Blank"
  | "Passage Reading"
  | "Story Questions"
  | "พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน 2534"
  | "พ.ร.ฎ.วิธีการบริหารกิจการบ้านเมืองที่ดี 2546"
  | "พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539"
  | "ป.อ.2499 (ในส่วนความผิดต่อตำแหน่งหน้าที่ราชการ)"
  | "พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่"
  | "พ.ร.บ.มาตราฐานทางจริยธรรม 2562";
export type QuestionDifficulty = "easy" | "medium" | "hard";
export type AnswerKey = "A" | "B" | "C" | "D";
export type QuestionSource = "pdf" | "nlp" | "llm" | "manual" | "python" | "python-rule" | "python-transformer";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
};

export type PublicUser = Omit<UserRecord, "passwordHash">;

export type QuestionRecord = {
  id: string;
  subject: ExamSubject;
  category?: ExamCategory;
  subcategory: ExamSubcategory;
  difficulty: QuestionDifficulty;
  question: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct_answer: AnswerKey;
  explanation: string;
  source: QuestionSource;
  createdAt: string;
  model_subcategory?: string;
  status?: "REVIEW_REQUIRED" | "VALID";
  quality_score?: number;
  topic_verified?: boolean;
  no_duplicate?: boolean;
  quality_passed?: boolean;
  hash?: string;
};

export type QuestionChoice = {
  key: AnswerKey;
  label: string;
  text: string;
};

export type ExamQuestion = {
  id: string;
  subject: ExamSubject;
  category?: ExamCategory;
  subcategory: ExamSubcategory;
  difficulty: QuestionDifficulty;
  question: string;
  choices: QuestionChoice[];
};

export type ExamSession = {
  subject: ExamSubject;
  category?: ExamCategory;
  subcategory?: ExamSubcategory | "all";
  count: number;
  durationSeconds: number;
  questions: ExamQuestion[];
};

export type ExamAnswer = {
  questionId: string;
  selectedKey: AnswerKey | null;
};

export type ExamResultRow = {
  id: string;
  userId: string;
  subject: ExamSubject;
  category?: ExamCategory;
  subcategory?: ExamSubcategory | "all";
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  score: number;
  durationSeconds: number;
  createdAt: string;
};

export type ExamReviewItem = {
  questionId: string;
  subject: ExamSubject;
  subcategory: ExamSubcategory;
  question: string;
  choices: QuestionChoice[];
  selectedKey: AnswerKey | null;
  correctKey: AnswerKey;
  explanation: string;
  isCorrect: boolean;
};

export type PerformanceBreakdown = {
  label: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  score: number;
};

export type ExamSubmissionSummary = {
  subject: ExamSubject;
  category?: ExamCategory;
  subcategory?: ExamSubcategory | "all";
  score: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  durationSeconds: number;
  review: ExamReviewItem[];
  performanceBySubject: PerformanceBreakdown[];
  performanceBySubcategory: PerformanceBreakdown[];
};

export type AuthTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
};

export type DashboardStats = {
  totalAttempts: number;
  bestScore: number;
  averageScore: number;
};

export type QuestionStats = {
  totalQuestions: number;
  byCategory: Record<ExamCategory, number>;
  byDifficulty: Record<QuestionDifficulty, number>;
};
