import type { NextConfig } from "next";

/**
 * PDFDock — 100% client-side, so the whole site statically exports to /out:
 * ready for GitHub → GitHub Pages (workflow: .github/workflows/deploy-pages.yml)
 * or Cloudflare (Pages or Workers static assets via wrangler.jsonc → ./out).
 * No server, no API routes, nothing paid anywhere.
 *
 * NEXT_PUBLIC_BASE_PATH — GitHub Pages serves a project repository under a
 * sub-path (https://<user>.github.io/pdfdock/), so the GitHub Pages
 * workflow builds with NEXT_PUBLIC_BASE_PATH=/pdfdock. Cloudflare Pages /
 * Workers / a custom domain / the <user>.github.io root repo all serve
 * from "/", and leave it unset (no basePath). The editor app itself never
 * needs to know which host it runs on.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
