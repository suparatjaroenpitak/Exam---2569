const nextConfig = {
  serverExternalPackages: ["xlsx", "pdf-parse"],
  experimental: {
    optimizePackageImports: ["clsx"]
  }
};

export default nextConfig;
