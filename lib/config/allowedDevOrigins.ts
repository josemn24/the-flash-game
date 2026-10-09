function isExactHost(host: string): boolean {
  const isIpv6 = host.startsWith("[") && host.endsWith("]");
  if (
    !isIpv6 &&
    (host.length > 253 ||
      !host.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))
  ) {
    return false;
  }

  try {
    return new URL(`http://${host}`).host === host;
  } catch {
    return false;
  }
}

export function getAllowedDevOrigins(value: string | undefined): string[] {
  const hosts = new Set(["127.0.0.1"]);
  for (const entry of value?.split(",") ?? []) {
    const host = entry.trim().toLowerCase();
    if (!host) continue;
    if (!isExactHost(host)) {
      throw new Error(
        "FLASH_DEV_ALLOWED_ORIGINS must contain exact IPs or hostnames without protocols, ports, paths or wildcards.",
      );
    }
    hosts.add(host);
  }
  return [...hosts];
}
