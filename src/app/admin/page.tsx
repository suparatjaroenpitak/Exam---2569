import { AppShell } from "@/components/app-shell";
import { AiGeneratorForm } from "@/components/admin/ai-generator-form";
import { AdminOverview } from "@/components/admin/admin-overview";
import { PdfImportForm } from "@/components/admin/pdf-import-form";
import { requireAdminPage } from "@/lib/server-guards";
import { getQuestionStats } from "@/services/question-service";

export default async function AdminPage() {
  const user = await requireAdminPage();
  const stats = await getQuestionStats();

  return (
    <AppShell
      user={user}
      title="Admin Dashboard"
      subtitle="Import question banks, generate new content, and monitor the Excel-backed inventory."
      titleKey="admin.title"
      subtitleKey="admin.subtitle"
    >
      <div className="space-y-6">
        <AdminOverview stats={stats} />
        <div className="grid gap-6 xl:grid-cols-2">
          <PdfImportForm />
          <AiGeneratorForm />
        </div>
      </div>
    </AppShell>
  );
}
