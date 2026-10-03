import { describe, expect, it } from "vitest";
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
