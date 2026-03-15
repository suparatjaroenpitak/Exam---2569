import { redirect } from "next/navigation";

import { getCurrentAuthToken, verifyAuthToken } from "@/lib/auth";
import type { PublicUser } from "@/lib/types";
import { findUserById, getOrCreateDefaultAdmin } from "@/services/auth-service";

export async function requireUserPage(): Promise<PublicUser> {
  await getOrCreateDefaultAdmin();
  const token = await getCurrentAuthToken();

  if (!token) {
    redirect("/login");
  }

  try {
    const payload = await verifyAuthToken(token);
    const user = await findUserById(payload.sub);

    if (!user) {
      redirect("/login");
    }

    return user as PublicUser;
  } catch {
    redirect("/login");
  }
}

export async function requireAdminPage(): Promise<PublicUser> {
  const user = await requireUserPage();

  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  return user;
}
