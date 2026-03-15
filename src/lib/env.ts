export const env = {
  dataDir: process.env.DATA_DIR || "data",
  jwtSecret: process.env.JWT_SECRET || "development-only-secret-change-me",
  wangchanBaseUrl: process.env.WANGCHAN_BASE_URL || "https://api-inference.huggingface.co",
  wangchanModel: process.env.WANGCHAN_MODEL || "airesearch/wangchanberta-base-att-spm-uncased",
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com",
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || "Admin12345!"
};
