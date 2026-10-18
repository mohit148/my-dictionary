import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false, // hides the Next.js corner badge in dev
  experimental: {
    // Import files are sent to a server action as text; allow big dictionaries.
    serverActions: { bodySizeLimit: "30mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
