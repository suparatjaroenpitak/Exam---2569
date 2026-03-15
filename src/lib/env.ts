export const env = {
  dataDir: process.env.DATA_DIR || "data",
  jwtSecret: process.env.JWT_SECRET || "development-only-secret-change-me",
  llmApiKey: process.env.OPEN_SOURCE_LLM_API_KEY || "",
  llmBaseUrl: process.env.OPEN_SOURCE_LLM_BASE_URL || "https://openrouter.ai/api/v1",
  llmModel: process.env.OPEN_SOURCE_LLM_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
  openAiApiKey: process.env.OPENAI_API_KEY || "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",
  openAiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  openAiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com",
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || "Admin12345!"
};
