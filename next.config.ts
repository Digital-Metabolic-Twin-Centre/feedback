import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { EMBED_FRAME_SOURCES } from "./lib/security/csp";

const isDevelopment = process.env.NODE_ENV === "development";

const globalCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  `frame-src 'self' ${EMBED_FRAME_SOURCES.join(" ")}`,
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "same-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: globalCsp,
  },

  // relaxed for PDF rendering
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" },
];

const nextConfig: NextConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  async redirects() {
    return [
      {
        source: "/participant/registration",
        destination: "/ecrfs/participant/registration",
        permanent: true,
      },
      {
        source: "/participant/visit",
        destination: "/ecrfs/participant/visit",
        permanent: true,
      },
      {
        source: "/participant/queries",
        destination: "/ecrfs/participant/queries",
        permanent: true,
      },
      {
        source: "/biospecimen/logs",
        destination: "/ecrfs/biospecimen/logs",
        permanent: true,
      },
      {
        source: "/adverse/events",
        destination: "/ecrfs/adverse/events",
        permanent: true,
      },
      {
        source: "/off/study",
        destination: "/ecrfs/off/study",
        permanent: true,
      },
      {
        source: "/shipment/tracking",
        destination: "/ecrf/shipment/tracking",
        permanent: true,
      },
      {
        source: "/shipment/receiving",
        destination: "/labs/shipment/receiving",
        permanent: true,
      },
      {
        source: "/analysis/schedule",
        destination: "/labs/analysis/schedule",
        permanent: true,
      },
      {
        source: "/google/drive",
        destination: "/central/resources",
        permanent: true
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withMDX(nextConfig);
