import {
  FLASH_POP_FEEDBACK_DURATION,
  MINI_WORDLE_ANSWER_REVEAL_DURATION,
} from "../../transitionTiming";
import type { ModeStep } from "../modes/policy";
import type { SessionRuntime } from "./runtime";
export function createAdvancement(
  runtime: SessionRuntime,
  prepare: () => Promise<void>,
  complete: () => Promise<void>,
) {
  const apply = async (step: ModeStep) => {
    if (step.type === "prepare") {
      runtime.commit({ type: "phase", phase: "preparing", clearQuestion: true });
      await prepare();
    } else if (step.type === "complete") await complete();
    else
      runtime.commit({
        type: "phase",
        phase: step.phase,
        stepIndex: step.stepIndex,
        questionIndex: step.questionIndex,
        clearQuestion: true,
      });
  };
  const next = () => apply(runtime.policy.next(runtime.state()));
  const afterAnswer = async () => {
    if (runtime.challenge.mode === "alphabet") {
      await next();
      return;
    }
    const feedback = () => {
      runtime.commit({ type: "phase", phase: "transition" });
      const status = runtime.state().lastResult?.status ?? "unanswered";
      runtime.schedule("advance", FLASH_POP_FEEDBACK_DURATION[status], () => {
        void next();
      });
    };
    if (runtime.state().phase === "answer-reveal")
      runtime.schedule("advance", MINI_WORDLE_ANSWER_REVEAL_DURATION, feedback);
    else feedback();
  };
  return { apply, next, afterAnswer };
}
