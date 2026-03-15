export const env = {
  dataDir: process.env.DATA_DIR || "data",
  jwtSecret: process.env.JWT_SECRET || "development-only-secret-change-me",
  llmApiKey: process.env.OPEN_SOURCE_LLM_API_KEY || "",
  llmBaseUrl: process.env.OPEN_SOURCE_LLM_BASE_URL || "https://openrouter.ai/api/v1",
  llmModel: process.env.OPEN_SOURCE_LLM_MODEL || "airesearch/wangchanberta-base-att-spm-uncased",
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  openAiBaseUrl: process.env.OPENAI_BASE_URL || "https://api-inference.huggingface.co",
  openAiModel: process.env.OPENAI_MODEL || "airesearch/wangchanberta-base-att-spm-uncased",
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com",
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || "Admin12345!"
};
