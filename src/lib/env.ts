export const env = {
  dataDir: process.env.DATA_DIR || "data",
  jwtSecret: process.env.JWT_SECRET || "development-only-secret-change-me",
  huggingFaceApiKey: process.env.HUGGINGFACE_API_KEY || "",
  thaiGeneratorBaseUrl: process.env.THAI_GENERATOR_BASE_URL || "https://api-inference.huggingface.co/models",
  // Primary generative model used for admin question generation. Default now set to Mistral.
  thaiGeneratorModel: process.env.THAI_GENERATOR_MODEL || "mistralai/mistral-7b-v0.1",
  // Optional Mistral fallback settings. If set, the generation service will
  // call this model when the primary Thai model fails to produce usable JSON.
  mistralBaseUrl: process.env.MISTRAL_BASE_URL || process.env.THAI_GENERATOR_BASE_URL || "https://api-inference.huggingface.co/models",
  mistralModel: process.env.MISTRAL_MODEL || "mistralai/mistral-7b-v0.1",
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com",
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || "Admin12345!"
};
