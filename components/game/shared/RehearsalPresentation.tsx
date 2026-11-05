"use client";
import { createContext, useContext } from "react";

export const RehearsalPresentation = createContext<{
  returnTo: string;
} | null>(null);
export function useRehearsalPresentation() {
  return useContext(RehearsalPresentation);
}

export const ChallengeRehearsalLink = createContext<{ href: string } | null>(null);
export function useChallengeRehearsalLink() {
  return useContext(ChallengeRehearsalLink);
}
