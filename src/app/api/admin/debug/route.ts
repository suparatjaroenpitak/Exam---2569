import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-guards";
import { loadQuestions } from "@/lib/excel-db";
import { readGenerationLogs } from "@/lib/generation-log";
import { readImportLog } from "@/lib/import-log";

export async function GET(request: Request) {
  const guard = await requireApiAdmin(request as any);
  if (guard.error) return guard.error;

  try {
    const questions = await loadQuestions();
    const genLogs = await readGenerationLogs();
    const importLogs = await readImportLog();

    return NextResponse.json({ totalQuestions: questions.length, recentQuestions: questions.slice(-10), generationLogs: genLogs.slice(-10), importLogs: importLogs.slice(-10) });
  } catch (err) {
    return NextResponse.json({ message: String(err) }, { status: 500 });
  }
}
