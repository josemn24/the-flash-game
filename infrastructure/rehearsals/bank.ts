import "server-only";
import type { RehearsalBankQuestion } from "@/types/gameplay/rehearsal";
import { validateBank } from "@/lib/rehearsals/bank";
import anagram from "@/data/rehearsals/bank/anagram.json";
import classification from "@/data/rehearsals/bank/classification.json";
import connect_pairs from "@/data/rehearsals/bank/connect-pairs.json";
import escape from "@/data/rehearsals/bank/escape.json";
import estimation from "@/data/rehearsals/bank/estimation.json";
import heat_map from "@/data/rehearsals/bank/heat-map.json";
import logic_code from "@/data/rehearsals/bank/logic-code.json";
import logic_matrix from "@/data/rehearsals/bank/logic-matrix.json";
import matching from "@/data/rehearsals/bank/matching.json";
import mini_wordle from "@/data/rehearsals/bank/mini-wordle.json";
import multiple_choice from "@/data/rehearsals/bank/multiple-choice.json";
import odd_one_out from "@/data/rehearsals/bank/odd-one-out.json";
import ordering from "@/data/rehearsals/bank/ordering.json";
import progressive_clues from "@/data/rehearsals/bank/progressive-clues.json";
import progressive_image from "@/data/rehearsals/bank/progressive-image.json";
import queens from "@/data/rehearsals/bank/queens.json";
import short_text from "@/data/rehearsals/bank/short-text.json";
import true_false from "@/data/rehearsals/bank/true-false.json";
import word_hashtag from "@/data/rehearsals/bank/word-hashtag.json";
import word_search from "@/data/rehearsals/bank/word-search.json";
import zip from "@/data/rehearsals/bank/zip.json";
const questions = [
  ...anagram,
  ...classification,
  ...connect_pairs,
  ...escape,
  ...estimation,
  ...heat_map,
  ...logic_code,
  ...logic_matrix,
  ...matching,
  ...mini_wordle,
  ...multiple_choice,
  ...odd_one_out,
  ...ordering,
  ...progressive_clues,
  ...progressive_image,
  ...queens,
  ...short_text,
  ...true_false,
  ...word_hashtag,
  ...word_search,
  ...zip,
] as RehearsalBankQuestion[];
let cached: readonly RehearsalBankQuestion[] | undefined;
export function rehearsalBank() {
  return (cached ??= validateBank(questions));
}
