export const env = {
  dataDir: process.env.DATA_DIR || "data",
  jwtSecret: process.env.JWT_SECRET || "development-only-secret-change-me",
  llmApiKey: process.env.OPEN_SOURCE_LLM_API_KEY || "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",
  llmBaseUrl: process.env.OPEN_SOURCE_LLM_BASE_URL || "https://openrouter.ai/api/v1",
  llmModel: process.env.OPEN_SOURCE_LLM_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com",
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || "Admin12345!"
};
