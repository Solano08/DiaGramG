import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  experimental: {
    proxyClientMaxBodySize: "20mb",
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
