import { AppShell } from "@/components/app-shell";
import ExamWorkspace from "@/components/exam/exam-workspace";
import { requireUserPage } from "@/lib/server-guards";

export default async function ExamPage() {
  const user = await requireUserPage();

  return (
    <AppShell
      user={user}
      title="Exam Simulator"
      subtitle="Run a timed exam with randomized questions, navigation controls, and instant grading."
      titleKey="exam.title"
      subtitleKey="exam.subtitle"
    >
      <ExamWorkspace isAdmin={user.role === "admin"} />
    </AppShell>
  );
}
