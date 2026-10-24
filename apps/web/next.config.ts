import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@docupulse/contracts"],
  // Monorepo root, so Vercel traces packages/contracts correctly.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
