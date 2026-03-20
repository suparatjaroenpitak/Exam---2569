import { spawnSync } from "child_process";
import path from "path";

export async function generateWithPythonEngine(input: { category: string; subcategory: string; count: number; difficulty: string }) {
  const py = process.env.PYTHON_EXEC || "python";
  const script = path.join(process.cwd(), "ai_engine", "question_generator.py");
  const payload = JSON.stringify({ subject: input.category, topic: input.subcategory, count: input.count, difficulty: input.difficulty });

  try {
    const res = spawnSync(py, [script], { input: payload, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
    if (res.error) throw res.error;
    if (res.status !== 0 && res.stderr) {
      throw new Error(res.stderr.toString());
    }
    const out = res.stdout ? res.stdout.toString() : "";
    if (!out) return [];
    const parsed = JSON.parse(out);
    if (!Array.isArray(parsed)) return [];
    // normalize minimal shape
    return parsed.map((r: any) => ({
      subject: r.subject || input.category,
      category: r.subject || input.category,
      subcategory: r.topic || input.subcategory,
      question: r.question,
      choice_a: r.choice_a,
      choice_b: r.choice_b,
      choice_c: r.choice_c,
      choice_d: r.choice_d,
      correct_answer: (r.correct_answer || "A").toUpperCase(),
      explanation: r.explanation || "",
      difficulty: r.difficulty || input.difficulty,
      source: "python"
    }));
  } catch (e) {
    return [];
  }
}
