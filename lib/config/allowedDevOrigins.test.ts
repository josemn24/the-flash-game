import { describe, expect, it } from "vitest";
import { getAllowedDevOrigins } from "./allowedDevOrigins";

describe("development origins", () => {
  it.each([undefined, "", "  ", ", ,,"])("keeps loopback by default for %j", (value) => {
    expect(getAllowedDevOrigins(value)).toEqual(["127.0.0.1"]);
  });

  it("trims, normalizes and deduplicates exact hosts", () => {
    expect(
      getAllowedDevOrigins(
        " 192.168.1.20, Flash-Mac.LOCAL, ,127.0.0.1,flash-mac.local,192.168.1.20 ",
      ),
    ).toEqual(["127.0.0.1", "192.168.1.20", "flash-mac.local"]);
  });

  it("accepts localhost and bracketed IPv6 hosts", () => {
    expect(getAllowedDevOrigins("localhost,[::1],[2001:DB8::1]")).toEqual([
      "127.0.0.1",
      "localhost",
      "[::1]",
      "[2001:db8::1]",
    ]);
  });

  it.each([
    "http://192.168.1.20",
    "https://flash-mac.local",
    "192.168.1.20:3000",
    "flash-mac.local:",
    "flash-mac.local/path",
    "flash-mac.local/",
    "flash-mac.local?x=1",
    "flash-mac.local#fragment",
    "user@flash-mac.local",
    "*.local",
    "*",
    "flash mac.local",
    "flash_mac.local",
    "flash..local",
    "-flash.local",
    "999.168.1.20",
    "127.1",
    "::1",
    "[::1]:3000",
    "[invalid]",
  ])("rejects an invalid host %s with the variable name", (value) => {
    expect(() => getAllowedDevOrigins(`valid.local,${value}`)).toThrow("FLASH_DEV_ALLOWED_ORIGINS");
  });
});
