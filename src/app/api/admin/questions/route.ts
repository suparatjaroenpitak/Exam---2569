import { NextResponse, type NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api-guards";
import { loadQuestions, saveQuestions } from "@/lib/prisma-db";

export async function DELETE(request: NextRequest) {
  const guard = await requireApiAdmin(request);
  if (guard.error) return guard.error;

  try {
    const payload = await request.json().catch(() => ({}));
    const { ids, action } = payload as { ids?: string[]; action?: string };

    const existing = await loadQuestions();

    let remaining = existing;
    if (action === "clear") {
      remaining = [];
    } else if (Array.isArray(ids) && ids.length > 0) {
      const idSet = new Set(ids.map(String));
      remaining = existing.filter((r) => !idSet.has(String(r.id)));
    } else {
      return NextResponse.json({ message: "No ids provided" }, { status: 400 });
    }

    // Save remaining rows by replacing the filtered collection in Prisma.
    await saveQuestions(remaining as any[]);

    return NextResponse.json({ message: "Deleted", remaining: remaining.length });
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
