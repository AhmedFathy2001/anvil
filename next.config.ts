import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker image can run the app
  // with just Node — no node_modules, no `next start`. Required for the per-clan container deploy.
  output: 'standalone',
};

export default nextConfig;
