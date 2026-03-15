import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { env } from "@/lib/env";
import type { AuthTokenPayload, PublicUser } from "@/lib/types";

export const AUTH_COOKIE_NAME = "exam_practice_token";

const secret = new TextEncoder().encode(env.jwtSecret);

export function sanitizeUser(user: { passwordHash?: string } & Record<string, unknown>) {
  const { passwordHash, ...rest } = user;
  return rest as PublicUser;
}

export async function signAuthToken(user: PublicUser) {
  return new SignJWT({
    email: user.email,
    role: user.role,
    name: user.name
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload> {
  const { payload } = await jwtVerify(token, secret);

  return {
    sub: String(payload.sub),
    email: String(payload.email),
    role: payload.role === "admin" ? "admin" : "user",
    name: String(payload.name)
  };
}

export async function getCurrentAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value;
}
