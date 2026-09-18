import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseImageOrigin = supabaseUrl ? new URL(supabaseUrl) : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseImageOrigin
      ? [
          {
            protocol: supabaseImageOrigin.protocol.replace(":", "") as "http" | "https",
            hostname: supabaseImageOrigin.hostname,
            ...(supabaseImageOrigin.port ? { port: supabaseImageOrigin.port } : {}),
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  async headers() {
    return [
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
