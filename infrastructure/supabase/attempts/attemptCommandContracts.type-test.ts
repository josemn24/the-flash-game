import { attemptSqlDecoders, type AttemptSqlCommandMap } from "./attemptCommandContracts";
import { callAttemptCommand } from "./attemptCommands";
type Assert<T extends true> = T;
export type AllCommandsHaveDecoders = Assert<
  keyof AttemptSqlCommandMap extends keyof typeof attemptSqlDecoders ? true : false
>;
// @ts-expect-error Missing a decoder must fail compilation.
export const incomplete: typeof attemptSqlDecoders = { start_attempt: (value) => value };
export async function rejectsInventedCommands() {
  // @ts-expect-error No arbitrary SQL command names or caller-selected return types.
  await callAttemptCommand({ authUserId: "actor" }, "invented_command", {});
  // @ts-expect-error The command fixes its input contract.
  await callAttemptCommand({ authUserId: "actor" }, "start_attempt", { attemptId: "a" });
}

declare const prepareInput: AttemptSqlCommandMap["prepare_interaction"]["input"];
declare const swapInput: AttemptSqlCommandMap["submit_word_hashtag_swap"]["input"];
export function preparationRequiresAuthoritativeContext() {
  // @ts-expect-error Preparation cannot silently fall back to invented item metadata.
  attemptSqlDecoders.prepare_interaction({}, prepareInput);
  // @ts-expect-error A swap requires the published item configuration.
  attemptSqlDecoders.submit_word_hashtag_swap({}, swapInput);
}
