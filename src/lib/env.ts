export const env = {
  dataDir: process.env.DATA_DIR || "data",
  jwtSecret: process.env.JWT_SECRET || "development-only-secret-change-me",
  huggingFaceApiKey: process.env.HUGGINGFACE_API_KEY || "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",
  thaiGeneratorBaseUrl: process.env.THAI_GENERATOR_BASE_URL || "https://api-inference.huggingface.co/models",
  // Primary Transformers model used for admin question generation.
  thaiGeneratorModel: process.env.THAI_GENERATOR_MODEL || process.env.TRANSFORMERS_MODEL || "Qwen/Qwen2.5-1.5B-Instruct",
  transformersModel: process.env.TRANSFORMERS_MODEL || process.env.THAI_GENERATOR_MODEL || "Qwen/Qwen2.5-1.5B-Instruct",
  transformersMaxNewTokens: process.env.TRANSFORMERS_MAX_NEW_TOKENS || "1400",
  transformersTemperature: process.env.TRANSFORMERS_TEMPERATURE || "0.95",
  // Legacy remote model settings kept for older non-admin code paths.
  mistralBaseUrl: process.env.MISTRAL_BASE_URL || process.env.THAI_GENERATOR_BASE_URL || "https://api-inference.huggingface.co/models",
  mistralModel: process.env.MISTRAL_MODEL || process.env.TRANSFORMERS_MODEL || process.env.THAI_GENERATOR_MODEL || "Qwen/Qwen2.5-1.5B-Instruct",
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com",
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || "Admin12345!"
};
