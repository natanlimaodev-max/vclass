import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // The API routes read prompts and scenarios from the monorepo `shared/` folder
  // at runtime. Trace from the repo root and include that folder so serverless
  // deploys (e.g. Vercel) ship it with the functions.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  outputFileTracingIncludes: {
    "/api/**/*": ["../../shared/**/*"],
  },
};

export default nextConfig;
