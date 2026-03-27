export const env = {
  dataDir: process.env.DATA_DIR || "data",
  jwtSecret: process.env.JWT_SECRET || "development-only-secret-change-me",
  databaseProvider: process.env.DATABASE_PROVIDER || "sqlite",
  databaseUrl: process.env.DATABASE_URL || "file:./prisma/dev.db",
  pythonAiUrl: process.env.PYTHON_AI_URL || (process.env.PYTHON_AI_HOSTPORT ? `http://${process.env.PYTHON_AI_HOSTPORT}` : "http://127.0.0.1:8000"),
  allowPythonCliFallback: process.env.ALLOW_PYTHON_CLI_FALLBACK ? process.env.ALLOW_PYTHON_CLI_FALLBACK === "1" : process.env.NODE_ENV !== "production",
  enableTransformerFallback: process.env.ENABLE_TRANSFORMER_FALLBACK === "1",
  huggingFaceApiKey: process.env.HUGGINGFACE_API_KEY || "",
  thaiGeneratorBaseUrl: process.env.THAI_GENERATOR_BASE_URL || "https://api-inference.huggingface.co/models",
  thaiGeneratorModel: process.env.THAI_GENERATOR_MODEL || process.env.TRANSFORMERS_MODEL || "Qwen/Qwen2.5-1.5B-Instruct",
  transformersModel: process.env.TRANSFORMERS_MODEL || process.env.THAI_GENERATOR_MODEL || "Qwen/Qwen2.5-1.5B-Instruct",
  transformersMaxNewTokens: process.env.TRANSFORMERS_MAX_NEW_TOKENS || "1400",
  transformersTemperature: process.env.TRANSFORMERS_TEMPERATURE || "0.95",
  mistralBaseUrl: process.env.MISTRAL_BASE_URL || process.env.THAI_GENERATOR_BASE_URL || "https://api-inference.huggingface.co/models",
  mistralModel: process.env.MISTRAL_MODEL || process.env.TRANSFORMERS_MODEL || process.env.THAI_GENERATOR_MODEL || "Qwen/Qwen2.5-1.5B-Instruct",
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com",
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || "change-me-in-env"
};
