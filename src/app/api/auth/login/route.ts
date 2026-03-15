import { NextResponse } from "next/server";
import { z } from "zod";

import { signAuthToken } from "@/lib/auth";
import { loginUser } from "@/services/auth-service";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export async function POST(request: Request) {
  try {
    const payload = loginSchema.parse(await request.json());
    const user = await loginUser(payload);
    const token = await signAuthToken(user);
    const response = NextResponse.json({ user, message: "Login successful" });

    response.cookies.set({
      name: "exam_practice_token",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to login" },
      { status: 400 }
    );
  }
}
