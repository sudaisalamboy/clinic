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
        // Apply to all routes
        source: "/(.*)",
        headers: [
          // CORS: do NOT reflect Origin. Block cross-origin credentialed requests.
          { key: "Access-Control-Allow-Origin", value: "" },
          { key: "Access-Control-Allow-Credentials", value: "false" },
          // Security headers
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Strip Alibaba Cloud FC metadata headers by overwriting with empty
          // (Next.js headers() adds these to the response, replacing any
          // upstream-injected values from the FC platform)
          { key: "X-Fc-Request-Id", value: "" },
          { key: "X-Fc-Error-Type", value: "" },
          { key: "X-Fc-Code-Checksum", value: "" },
          { key: "X-Fc-Invocation-Duration", value: "" },
          { key: "X-Fc-Max-Memory-Usage", value: "" },
          { key: "X-Fc-Log-Result", value: "" },
          { key: "X-Fc-Invocation-Code-Version", value: "" },
          { key: "X-Fc-Instance-Id", value: "" },
          { key: "Access-Control-Expose-Headers", value: "" },
          { key: "Abc", value: "" },
        ],
      },
    ];
  },
};

export default nextConfig;
