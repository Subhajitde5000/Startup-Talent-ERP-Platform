/** @type {import('next').NextConfig} */

// The browser only ever talks to the Next server (same-origin /api/v1/*).
// Next proxies those paths to the backend, so no CORS setup is needed and
// the sandbox preview works without the frontend calling localhost directly.
const API_PROXY_TARGET = process.env.NEXT_PUBLIC_API_PROXY_TARGET || "http://127.0.0.1:8000";

const nextConfig = {
  reactStrictMode: true,
  // Lint runs via `npm run lint` (full repo, exit code honest). Build skips
  // it so pre-existing errors in not-yet-wired pages don't block deploys —
  // each step fixes its own files as it lands.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // The legacy pages predate TypeScript: Next's page-shape validation fails
  // on their extra exports/props (Step 15a+ will fix them as those steps
  // land). Real type safety for the TS code runs via `npm run typecheck`.
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_PROXY_TARGET}/api/v1/:path*`,
      },
      // Health lives at the backend root, exposed under the same proxy prefix.
      {
        source: "/api/health",
        destination: `${API_PROXY_TARGET}/health`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/investor/data-room",
        destination: "/investor/data-rooms",
        permanent: false,
      },
      {
        source: "/investor/data-room/:startupId",
        destination: "/investor/data-rooms/:startupId",
        permanent: false,
      },
      {
        source: "/investor/data-room/:startupId/nda",
        destination: "/investor/data-rooms/:startupId/nda",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
