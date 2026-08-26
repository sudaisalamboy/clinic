import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy.
//
// - `unsafe-eval` is required ONLY in development (webpack dev-source-maps
//   / react-refresh evaluate code); production builds must never allow it,
//   because eval() makes any XSS trivially exploitable.
// - `ws:` (insecure websocket) is likewise dev-only (HMR); production
//   allows only wss:.
// - `unsafe-inline` for scripts is retained because Next.js injects inline
//   hydration scripts; moving to nonce-based CSP requires middleware-level
//   header rewrites and is documented as a future hardening step.
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self'${isDev ? " ws: wss:" : " wss:"}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  // Strict mode catches side-effect bugs (double-invoked effects) during
  // development — kept ON deliberately.
  reactStrictMode: true,
  // Security headers — applied to all routes.
  //
  // CORS: this app is same-origin only; we simply DO NOT emit any
  // Access-Control-* headers (an empty ACAO string is non-standard and
  // pointless).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
