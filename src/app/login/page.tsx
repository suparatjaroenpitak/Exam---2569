import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <main className="theme-screen flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <AuthForm mode="login" />
    </main>
  );
}
