import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.resolve('.'),
  },
  serverExternalPackages: ["@xenova/transformers", "onnxruntime-node"],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "sharp$": false,
        "onnxruntime-node$": false,
      };
    }
    return config;
  },
};

export default nextConfig;
