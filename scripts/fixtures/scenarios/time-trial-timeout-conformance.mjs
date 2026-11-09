import { sessionFixture } from "./competitive-session-fixture.mjs";
import { timeTrialQueensQuestions } from "../../../data/mock/timeTrialFixtures.mjs";

export default sessionFixture({
  id: "time-trial-timeout-conformance",
  mode: "time-trial",
  title: "Contrarreloj timeout de conformidad",
  // Leave time for the browser to retry a lost checkpoint before the deadline.
  globalTimeLimitMs: 10_000,
  modeConfig: { queensTimeoutPartialCredit: true },
  questions: timeTrialQueensQuestions,
});
