import { AuthForm } from "@/components/auth/auth-form";
import { PreferenceControls } from "@/components/ui/preference-controls";

export default function RegisterPage() {
  return (
    <main className="theme-screen relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="absolute right-4 top-4 z-10 sm:right-8 sm:top-8">
        <PreferenceControls />
      </div>
      <AuthForm mode="register" />
    </main>
  );
}
