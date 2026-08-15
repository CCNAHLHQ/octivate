/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Use `next start` (npm start). Standalone output is incompatible with next start
  // and was producing unreliable boots / stale asset failures in this deploy layout.
  // Keep pdf-parse + canvas outside the Turbopack/webpack graph so the pdfjs worker resolves.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  experimental: {
    // Tree-shake heavy packages across the app
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
    // Avatar data URLs can approach ~14 MB JSON for a 10 MB image.
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

module.exports = nextConfig;
