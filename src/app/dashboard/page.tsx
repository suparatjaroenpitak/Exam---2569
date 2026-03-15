import { AppShell } from "@/components/app-shell";
import { ExamConfigCard } from "@/components/dashboard/exam-config-card";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { HistoryTable } from "@/components/dashboard/history-table";
import { requireUserPage } from "@/lib/server-guards";
import { getDashboardStats, getHistoryForUser } from "@/services/history-service";

export default async function DashboardPage() {
  const user = await requireUserPage();
  const [stats, history] = await Promise.all([getDashboardStats(user.id), getHistoryForUser(user.id)]);

  return (
    <AppShell
      user={user}
      title="Dashboard"
      subtitle="Configure exams, review your latest performance, and keep your preparation focused."
      titleKey="dashboard.title"
      subtitleKey="dashboard.subtitle"
    >
      <DashboardStats stats={stats} />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <ExamConfigCard />
        <HistoryTable history={history} />
      </div>
    </AppShell>
  );
}
