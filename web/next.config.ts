import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (Azure Container Apps)
  output: "standalone",
};

export default nextConfig;
