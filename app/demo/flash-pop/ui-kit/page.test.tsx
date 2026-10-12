import { afterEach, describe, expect, it, vi } from "vitest";
import LegacyUiKitPage from "./page";
const mocks = vi.hoisted(() => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("legacy UI kit route", () => {
  it("redirects to the catalogue only in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    LegacyUiKitPage();
    expect(mocks.redirect).toHaveBeenCalledWith("/design-system");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
  it("stops before redirecting in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.notFound.mockImplementationOnce(() => {
      throw new Error("404");
    });
    expect(() => LegacyUiKitPage()).toThrow("404");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
