import { AppShell } from "@/components/app-shell";
import { AdminOverview } from "@/components/admin/admin-overview";
import { NlpGeneratorForm } from "@/components/admin/nlp-generator-form";
import { PdfImportForm } from "@/components/admin/pdf-import-form";
import { QuestionBankList } from "@/components/admin/question-bank-list";
import { requireAdminPage } from "@/lib/server-guards";
import { getQuestionStats, getQuestions } from "@/services/question-service";

export default async function AdminPage() {
  const user = await requireAdminPage();
  const stats = await getQuestionStats();
  const questions = await getQuestions();

  return (
    <AppShell
      user={user}
      title="Admin Dashboard"
      subtitle="Import question banks, generate Python-verified content, and monitor the Prisma-backed inventory."
      titleKey="admin.title"
      subtitleKey="admin.subtitle"
    >
      <div className="space-y-6">
        <AdminOverview stats={stats} />
        <div className="grid gap-6 xl:grid-cols-2">
          <PdfImportForm />
          <NlpGeneratorForm />
        </div>
        <QuestionBankList questions={[...questions].reverse()} />
      </div>
    </AppShell>
  );
}
