import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // A parent lockfile (~ pnpm-lock.yaml) confuses Turbopack's root inference;
  // pin it to this project directory.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default withNextIntl(nextConfig);
