"use client";

import { useState, useSyncExternalStore } from "react";

type KeyboardMode = "game" | "device";
const mobileQuery = "(max-width: 640px)";
const mobileSnapshot = () =>
  typeof window.matchMedia === "function" && window.matchMedia(mobileQuery).matches;
const serverMobileSnapshot = () => false;
const subscribeToMobile = (listener: () => void) => {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};

export function useMiniWordleKeyboardMode() {
  const [mode, setMode] = useState<KeyboardMode>("game");
  const mobile = useSyncExternalStore(subscribeToMobile, mobileSnapshot, serverMobileSnapshot);
  return [mobile ? "game" : mode, setMode, !mobile] as const;
}
