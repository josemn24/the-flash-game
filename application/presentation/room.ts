import type { GameMode } from "@/types/domain";

export const ROOM_ART_FALLBACK = "/flash-pop/concepts/pyramid-soft-diorama.webp";

export const ROOM_ART_BY_MODE: Readonly<Record<GameMode, string>> = {
  flash: "/flash-pop/concepts/flash-floating-cards.webp",
  alphabet: "/flash-pop/concepts/alphabet-letter-path.webp",
  survival: "/flash-pop/concepts/survival-last-beacon.webp",
  narrative: "/flash-pop/concepts/narrative-story-trail.webp",
  pyramid: ROOM_ART_FALLBACK,
};

export function getChallengeImage(mode: GameMode) {
  return ROOM_ART_BY_MODE[mode];
}

export function getChallengeFormatLabel(mode: GameMode) {
  const labels: Readonly<Record<GameMode, string>> = {
    flash: "Flash",
    alphabet: "Alfabeto",
    survival: "Supervivencia",
    narrative: "Narrativa",
    pyramid: "La Pirámide",
  };
  return labels[mode];
}

export function getChallengeDisplayTitle(title: string, mode: GameMode) {
  const prefix = `${getChallengeFormatLabel(mode)}:`;
  return title.startsWith(prefix) ? title.slice(prefix.length).trim() : title;
}
