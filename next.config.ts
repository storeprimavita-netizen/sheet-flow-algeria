import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // A parent lockfile (~ pnpm-lock.yaml) confuses Turbopack's root inference;
  // pin it to this project directory.
  turbopack: {
    root: import.meta.dirname,
  },
  // No single root layout (app + store each own one): a neutral global 404.
  experimental: { globalNotFound: true },
  // Baseline hardening (OWASP A02). No CSP yet: next-intl + Next inline
  // scripts need nonces — ponytail: add a nonce CSP in proxy.ts if required.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
