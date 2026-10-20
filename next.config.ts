import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// Certificate images and other public files are served from Supabase Storage.
const supabase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

// Without nonces, so pages stay static and cached: Next.js's own inline
// scripts need 'unsafe-inline'. The policy still keeps scripts, frames, forms
// and plugins to this site, and stops other sites framing it. It is reported
// rather than enforced until the reports (api/csp-report) come back clean.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabase}${isDev ? " ws: wss:" : ""}`,
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // upgrade-insecure-requests only works in an enforced policy (a report-only
  // one logs a warning on every page instead): add it back when enforcing.
  // report-uri alone: with report-to present Chrome drops it for the Reporting
  // API, which batches reports and did not deliver them in testing.
  "report-uri /api/csp-report",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: csp },
  // Enforced now: no framing (clickjacking on the owner sign-in), no MIME
  // sniffing, only the origin sent to other sites, and no device features.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
