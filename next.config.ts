import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Security headers
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          // Do NOT reflect Origin. Only allow same-origin.
          // Cross-origin requests with credentials are blocked.
          { key: "Access-Control-Allow-Origin", value: "" },
          { key: "Access-Control-Allow-Credentials", value: "false" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },
};

export default nextConfig;
