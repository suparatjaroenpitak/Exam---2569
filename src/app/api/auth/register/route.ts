import { NextResponse } from "next/server";
import { z } from "zod";

import { signAuthToken } from "@/lib/auth";
import { registerUser } from "@/services/auth-service";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
});

export async function POST(request: Request) {
  try {
    const payload = registerSchema.parse(await request.json());
    const user = await registerUser(payload);
    const token = await signAuthToken(user);
    const response = NextResponse.json({ user, message: "Registration successful" });

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
      { message: error instanceof Error ? error.message : "Unable to register" },
      { status: 400 }
    );
  }
}
