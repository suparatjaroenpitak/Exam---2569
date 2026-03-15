import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/api-guards";

export async function GET(request: NextRequest) {
  const guard = await requireApiUser(request);

  if (guard.error) {
    return guard.error;
  }

  return NextResponse.json({ user: guard.user });
}
