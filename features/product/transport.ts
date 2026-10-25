import type { ProductEventInput } from "@/types/contracts/product-measurement";
/** Best effort only: no storage, gameplay quota, or wait in a game command. */
export async function sendProductEvent(input: ProductEventInput, fetcher: typeof fetch = fetch) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetcher("/api/product/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        keepalive: true,
      });
      if (response.ok || response.status < 500) return;
    } catch {
      /* Navigation/network failures never block gameplay. */
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
