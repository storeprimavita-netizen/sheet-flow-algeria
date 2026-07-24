import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A parent lockfile (~ pnpm-lock.yaml) confuses Turbopack's root inference;
  // pin it to this project directory.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
