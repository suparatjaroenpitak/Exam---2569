export {
  appendHistory,
  appendQuestions,
  appendUsers,
  buildQuestionHash,
  loadHistory,
  loadQuestions,
  loadUsers,
  saveHistory,
  saveQuestions,
  saveUsers
} from "@/lib/prisma-db";

export async function appendQuestionsTransactional() {
  return { success: true };
}

export async function restoreFromBackup() {
  return false;
}
