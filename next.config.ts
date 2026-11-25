import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sample PDFs and spreadsheets are read at runtime by the "Use sample data" route.
  outputFileTracingIncludes: { "/api/batches/sample": ["./samples/**/*"] },
};

export default nextConfig;
