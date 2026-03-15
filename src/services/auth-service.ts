import bcrypt from "bcryptjs";

import { env } from "@/lib/env";
import { appendUsers, loadUsers, saveUsers } from "@/lib/excel-db";
import { sanitizeUser } from "@/lib/auth";
import type { PublicUser, UserRecord } from "@/lib/types";

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function getOrCreateDefaultAdmin() {
  const users = await loadUsers();
  const existing = users.find((user) => user.email.toLowerCase() === env.defaultAdminEmail.toLowerCase());

  if (existing) {
    return sanitizeUser(existing);
  }

  const passwordHash = await bcrypt.hash(env.defaultAdminPassword, 10);
  const admin: UserRecord = {
    id: createId("user"),
    name: "System Admin",
    email: env.defaultAdminEmail,
    passwordHash,
    role: "admin",
    createdAt: new Date().toISOString()
  };

  await appendUsers([admin]);
  return sanitizeUser(admin);
}

export async function registerUser(input: { name: string; email: string; password: string }): Promise<PublicUser> {
  const users = await loadUsers();
  const email = input.email.trim().toLowerCase();

  if (users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error("Email is already registered");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user: UserRecord = {
    id: createId("user"),
    name: input.name.trim(),
    email,
    passwordHash,
    role: "user",
    createdAt: new Date().toISOString()
  };

  await appendUsers([user]);
  return sanitizeUser(user);
}

export async function loginUser(input: { email: string; password: string }): Promise<PublicUser> {
  await getOrCreateDefaultAdmin();
  const users = await loadUsers();
  const user = users.find((entry) => entry.email.toLowerCase() === input.email.trim().toLowerCase());

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isMatch = await bcrypt.compare(input.password, user.passwordHash);

  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  return sanitizeUser(user);
}

export async function findUserById(id: string) {
  const users = await loadUsers();
  const user = users.find((entry) => entry.id === id);
  return user ? (sanitizeUser(user) as PublicUser) : null;
}

export async function listUsers() {
  const users = await loadUsers();
  return users.map((user) => sanitizeUser(user));
}

export async function resetUsers(rows: UserRecord[]) {
  await saveUsers(rows);
}
