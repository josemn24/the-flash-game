import { describe, expect, it } from "vitest";
import { getLocalStorageRewrite, resolveLocalStorageUrl } from "./localStorageProxy";

describe("local Supabase Storage proxy", () => {
  it.each(["127.0.0.1", "localhost", "[::1]"])(
    "proxies only Storage object endpoints for the development stack on %s",
    (host) => {
      expect(getLocalStorageRewrite(`http://${host}:54321`, "development")).toEqual({
        source: "/__local-supabase/storage/v1/object/:path*",
        destination: `http://${host}:54321/storage/v1/object/:path*`,
      });
      expect(
        resolveLocalStorageUrl(
          `http://${host}:54321/storage/v1/object/public/avatars/player.png`,
          `http://${host}:54321`,
          "development",
        ),
      ).toBe("/__local-supabase/storage/v1/object/public/avatars/player.png");
    },
  );

  it.each(["production", "test", undefined])("does not proxy in %s", (nodeEnv) => {
    const source = "http://127.0.0.1:54321/storage/v1/object/public/avatars/player.png";
    expect(getLocalStorageRewrite("http://127.0.0.1:54321", nodeEnv)).toBeNull();
    expect(resolveLocalStorageUrl(source, "http://127.0.0.1:54321", nodeEnv)).toBe(source);
  });

  it("keeps hosted Supabase URLs unchanged in development", () => {
    const supabaseUrl = "https://project.supabase.co";
    const source = `${supabaseUrl}/storage/v1/object/sign/questions/image.png?token=signed`;
    expect(getLocalStorageRewrite(supabaseUrl, "development")).toBeNull();
    expect(resolveLocalStorageUrl(source, supabaseUrl, "development")).toBe(source);
  });

  it.each([undefined, ""])("does not proxy without a configured URL: %s", (supabaseUrl) => {
    const source = "http://127.0.0.1:54321/storage/v1/object/public/avatars/player.png";
    expect(getLocalStorageRewrite(supabaseUrl, "development")).toBeNull();
    expect(resolveLocalStorageUrl(source, supabaseUrl, "development")).toBe(source);
  });

  it("reports malformed development configuration instead of silently disabling the proxy", () => {
    expect(() => getLocalStorageRewrite("not a URL", "development")).toThrow(TypeError);
    expect(() => resolveLocalStorageUrl("/visuals/image.png", "not a URL", "development")).toThrow(
      TypeError,
    );
    expect(getLocalStorageRewrite("not a URL", "production")).toBeNull();
  });

  it.each([
    "public/avatars/photo%20one.png",
    "sign/questions/image%23one.png",
    "upload/sign/avatars/player%2Bphoto.png",
  ])("keeps encoded paths, signed query parameters and fragments on %s", (objectPath) => {
    const source = `http://127.0.0.1:54321/storage/v1/object/${objectPath}?token=a%2Fb%2Bc&download=foto%20perfil.png#crop%20one`;
    expect(resolveLocalStorageUrl(source, "http://127.0.0.1:54321", "development")).toBe(
      `/__local-supabase/storage/v1/object/${objectPath}?token=a%2Fb%2Bc&download=foto%20perfil.png#crop%20one`,
    );
  });

  it.each([
    "/visuals/image.png",
    "not a URL",
    "data:image/png;base64,test",
    "https://other.example/storage/v1/object/public/image.png",
    "http://127.0.0.1:54322/storage/v1/object/public/image.png",
    "http://localhost:54321/storage/v1/object/public/image.png",
    "https://127.0.0.1:54321/storage/v1/object/public/image.png",
    "http://127.0.0.1:54321/auth/v1/user",
    "http://127.0.0.1:54321/storage/v1/object-other/image.png",
  ])("does not rewrite unrelated sources: %s", (source) => {
    expect(resolveLocalStorageUrl(source, "http://127.0.0.1:54321", "development")).toBe(source);
  });
});
