import type { NextConfig } from "next";
// @ts-ignore - OpenNext types
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@prooflyt/contracts", "@prooflyt/domain", "@prooflyt/mapping"],
  env: {
    PROOFLYT_API_BASE: process.env.PROOFLYT_API_BASE || "https://prooflyt-msp-api.harshshah-5d8.workers.dev/api",
    PROOFLYT_DEMO_TOKEN: process.env.PROOFLYT_DEMO_TOKEN || "session-user-arjun-boot",
    PROOFLYT_ADMIN_TOKEN: process.env.PROOFLYT_ADMIN_TOKEN || "session-ops-boot",
  },
};

export default nextConfig;
