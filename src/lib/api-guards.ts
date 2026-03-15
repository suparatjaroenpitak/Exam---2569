import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import type { PublicUser } from "@/lib/types";
import { findUserById } from "@/services/auth-service";

type ApiGuardResult = { user: PublicUser; error?: never } | { error: NextResponse; user?: never };

export async function requireApiUser(request: NextRequest): Promise<ApiGuardResult> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }

  try {
    const payload = await verifyAuthToken(token);
    const user = await findUserById(payload.sub);

    if (!user) {
      return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
    }

    return { user };
  } catch {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }
}

export async function requireApiAdmin(request: NextRequest): Promise<ApiGuardResult> {
  const result = await requireApiUser(request);

  if (result.error) {
    return result;
  }

  if (result.user.role !== "admin") {
    return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
  }

  return result;
}
