export const env = {
  dataDir: process.env.DATA_DIR || "data",
  jwtSecret: process.env.JWT_SECRET || "development-only-secret-change-me",
  huggingFaceApiKey: process.env.HUGGINGFACE_API_KEY || "",
  thaiGeneratorBaseUrl: process.env.THAI_GENERATOR_BASE_URL || "https://api-inference.huggingface.co/models",
  thaiGeneratorModel: process.env.THAI_GENERATOR_MODEL || "typhoon-ai/llama3.1-typhoon2-8b-instruct",
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com",
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || "Admin12345!"
};
