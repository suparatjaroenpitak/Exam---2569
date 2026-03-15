import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/api-guards";
import { getHistoryForUser } from "@/services/history-service";

export async function GET(request: NextRequest) {
  const guard = await requireApiUser(request);

  if (guard.error) {
    return guard.error;
  }

  const history = await getHistoryForUser(guard.user.id);
  return NextResponse.json({ history });
}
