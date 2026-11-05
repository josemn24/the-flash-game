// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CompetitiveLifecycleNotice } from "./CompetitiveLifecycleNotice";

afterEach(cleanup);
it("offers projection reload independently from permission to replay a rejected write", () => {
  const onRetry = vi.fn(async () => {});
  render(
    <CompetitiveLifecycleNotice
      busy={false}
      onRetry={onRetry}
      error={{
        operation: "projection",
        message: "Recarga",
        retryable: false,
        recoveryAction: "refresh",
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Recargar partida" }));
  expect(onRetry).toHaveBeenCalledOnce();
});
it("does not offer replay after a definitive authorization failure", () => {
  render(
    <CompetitiveLifecycleNotice
      busy={false}
      onRetry={async () => {}}
      error={{ operation: "answer", message: "Sin permiso", retryable: false }}
    />,
  );
  expect(screen.queryByRole("button")).toBeNull();
});
