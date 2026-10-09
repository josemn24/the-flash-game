import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "./next.config";

describe("demo route redirects", () => {
  it("keeps the demo surface under /demo with permanent redirects", async () => {
    const redirects = await nextConfig.redirects?.();

    expect(redirects).toEqual(
      expect.arrayContaining([
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
      ]),
    );
  });
});

describe("local development configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadConfig({
    nodeEnv = "development",
    supabaseUrl = "http://127.0.0.1:54321",
    allowedOrigins,
  }: {
    nodeEnv?: string;
    supabaseUrl?: string;
    allowedOrigins?: string;
  } = {}) {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", nodeEnv);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
    vi.stubEnv("FLASH_DEV_ALLOWED_ORIGINS", allowedOrigins);
    return (await import("./next.config")).default;
  }

  it("allows only explicit loopback by default", async () => {
    const config = await loadConfig();
    expect(config.allowedDevOrigins).toEqual(["127.0.0.1"]);
  });

  it("adds normalized local hosts from the environment", async () => {
    const config = await loadConfig({
      allowedOrigins: " 192.168.1.20, FLASH-MAC.local, , flash-mac.LOCAL,127.0.0.1 ",
    });
    expect(config.allowedDevOrigins).toEqual(["127.0.0.1", "192.168.1.20", "flash-mac.local"]);
  });

  it("fails clearly for malformed development origins", async () => {
    await expect(loadConfig({ allowedOrigins: "http://192.168.1.20:3000" })).rejects.toThrow(
      "FLASH_DEV_ALLOWED_ORIGINS",
    );
  });

  it.each(["production", "test"])("ignores additional origins in %s", async (nodeEnv) => {
    const config = await loadConfig({ nodeEnv, allowedOrigins: "*.local" });
    expect(config.allowedDevOrigins).toEqual(["127.0.0.1"]);
  });

  it.each(["localhost", "127.0.0.1", "[::1]"])(
    "buffers the complete 50 MiB upload for local Storage on %s",
    async (host) => {
      const config = await loadConfig({ supabaseUrl: `http://${host}:54321` });
      expect(config.experimental?.proxyClientMaxBodySize).toBe(50 * 1024 * 1024);
      expect(await config.rewrites?.()).toEqual([
        {
          source: "/__local-supabase/storage/v1/object/:path*",
          destination: `http://${host}:54321/storage/v1/object/:path*`,
        },
      ]);
    },
  );

  it.each([
    { nodeEnv: "production", supabaseUrl: "http://127.0.0.1:54321" },
    { nodeEnv: "test", supabaseUrl: "http://127.0.0.1:54321" },
    { supabaseUrl: "https://example.supabase.co" },
    { supabaseUrl: "" },
  ])("keeps Next's default buffer when the proxy is inactive: %j", async (env) => {
    const config = await loadConfig(env);
    expect(config.experimental?.proxyClientMaxBodySize).toBeUndefined();
    expect(await config.rewrites?.()).toEqual([]);
  });

  it("uses the same resolved rewrite and buffer throughout the config lifetime", async () => {
    const config = await loadConfig();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    expect(config.experimental?.proxyClientMaxBodySize).toBe(50 * 1024 * 1024);
    expect(await config.rewrites?.()).toEqual([
      {
        source: "/__local-supabase/storage/v1/object/:path*",
        destination: "http://127.0.0.1:54321/storage/v1/object/:path*",
      },
    ]);
  });
});
