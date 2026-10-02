"use client";
import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import type { LifecycleError } from "@/features/game/competitive/core/sessionReducer";
export function CompetitiveLifecycleNotice({
  error,
  busy,
  onRetry,
}: {
  error?: LifecycleError;
  busy: boolean;
  onRetry: () => Promise<void>;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!error?.retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [error?.retryAt]);
  if (!error) return null;
  const waiting = Boolean(error.retryAt && now < error.retryAt);
  return (
    <Card role="alert" className="mx-auto my-4 max-w-xl">
      <p>{error.message}</p>
      <Button
        type="button"
        className="mt-3"
        disabled={busy || waiting}
        onClick={() => void onRetry()}
      >
        {busy ? "Reintentando…" : waiting ? "Espera para reintentar" : "Reintentar partida"}
      </Button>
    </Card>
  );
}
