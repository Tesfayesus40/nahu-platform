import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output so the Dockerfile can ship a minimal runtime image.
  output: "standalone",
  // Pin tracing to the monorepo root so standalone always nests as
  // apps/admin-web/server.js (same layout locally and in Docker/Railway).
  outputFileTracingRoot: path.join(__dirname, "../.."),
  poweredByHeader: false,
};

export default nextConfig;
