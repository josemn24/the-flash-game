export type MiniWordleWordLength = 4 | 5;

export type MiniWordleLetterStatus = "correct" | "present" | "absent";

export type MiniWordleLetterFeedback = {
  letter: string;
  status: MiniWordleLetterStatus;
};
