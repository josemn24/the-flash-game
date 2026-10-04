import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseImageOrigin = supabaseUrl ? new URL(supabaseUrl) : null;

const nextConfig: NextConfig = {
  distDir: process.env.FLASH_NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: supabaseImageOrigin
      ? [
          {
            protocol: supabaseImageOrigin.protocol.replace(":", "") as "http" | "https",
            hostname: supabaseImageOrigin.hostname,
            ...(supabaseImageOrigin.port ? { port: supabaseImageOrigin.port } : {}),
            pathname: "/storage/v1/object/**",
          },
        ]
      : [],
  },
  async redirects() {
    return [
      {
        source: "/flash-pop-concepts",
        destination: "/demo/flash-pop-concepts",
        permanent: true,
      },
      {
        source: "/flash-pop-typography",
        destination: "/demo/flash-pop-typography",
        permanent: true,
      },
      {
        source: "/flash-pop",
        destination: "/demo/flash-pop",
        permanent: true,
      },
      {
        source: "/flash-pop/:path((?!concepts(?:/|$)).*)",
        destination: "/demo/flash-pop/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
      {
        source: "/dictionaries/es-general-4.v1.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
