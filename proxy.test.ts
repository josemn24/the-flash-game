import { NextRequest, NextResponse } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy, config } from "./proxy";
const mocks = vi.hoisted(() => ({ updateSession: vi.fn() }));
vi.mock("@/infrastructure/supabase/auth/proxy", () => ({ updateSession: mocks.updateSession }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("design system availability before authentication", () => {
  it("serves the public service worker without session middleware while protecting page routes", () => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/sw.js" })).toBe(false);
    for (const url of [
      "/design-system",
      "/design-system/preview/feedback",
      "/admin",
      "/sw.js-extra",
    ])
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true);
  });
  it.each([
    "/design-system",
    "/design-system/preview/feedback",
    "/demo/flash-pop/ui-kit",
    "/demo/flash-pop/ui-kit/",
  ])("does not contact authentication in development: %s", async (path) => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await proxy(new NextRequest(`http://localhost${path}`));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });
  it("serves the approved local Pyramid rehearsal without contacting authentication", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/demo/flash-pop/desafios/tabarnia-challenge-05"),
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });
  it("serves the approved local Flash rehearsal without contacting authentication", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/demo/flash-pop/desafios/tabarnia-flash-01"),
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });
  it("returns 404 for other demo challenge identifiers before authentication", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/demo/flash-pop/desafios/tabarnia-challenge-06"),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });
  it.each(["production", "test"])("hides the catalogue in %s", async (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    for (const path of [
      "/design-system",
      "/design-system/componentes/botones",
      "/design-system/preview/feedback",
      "/demo/flash-pop/ui-kit",
    ]) {
      const response = await proxy(new NextRequest(`http://localhost${path}`));
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not Found");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    }
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });
  it.each([
    "/design-system/unknown",
    "/design-system/componentes/missing",
    "/design-system/patrones/missing",
    "/design-system/preview/missing",
    "/design-system/preview/feedback/extra",
  ])("returns HTTP 404 for unknown development routes before streaming: %s", async (path) => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await proxy(new NextRequest(`http://localhost${path}`));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });
  it.each([
    "/",
    "/admin",
    "/salas/demo",
    "/desafios/tabarnia-challenge-05",
    "/desafios/tabarnia-flash-01",
    "/design-system-extra",
    "/demo/flash-pop/ui-kit-extra",
  ])("preserves authentication for other routes: %s", async (path) => {
    const authenticated = NextResponse.next();
    mocks.updateSession.mockResolvedValueOnce(authenticated);
    expect(await proxy(new NextRequest(`http://localhost${path}`))).toBe(authenticated);
    expect(mocks.updateSession).toHaveBeenCalledOnce();
  });
});
