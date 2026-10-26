import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  async headers() {
    // Supabase JS calls the project's REST/Auth/Storage endpoints from the
    // browser, and listing photos are served from Supabase Storage — both
    // live under *.supabase.co, matching the remotePatterns above. Realtime
    // uses the same hosts over secure WebSockets.
    // 'unsafe-inline' on script/style is a deliberate trade-off: the
    // theme-flash-prevention script in app/layout.tsx and the inline
    // style={{width}} bar in ListingPreviewCard both need it, and there's
    // no known XSS sink in this app to protect against today. Everything
    // else (object-src, base-uri, frame-ancestors, connect-src, img-src)
    // is locked down.
    // Next's dev-mode Fast Refresh evaluates code via eval(), which the
    // strict script-src below blocks — only relax it outside production.
    const scriptSrc =
      process.env.NODE_ENV === "production"
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
