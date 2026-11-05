import { sessionFixture } from "./competitive-session-fixture.mjs";
import { timeTrialQueensQuestions } from "../../../data/mock/timeTrialFixtures.mjs";

export default sessionFixture({
  id: "time-trial-timeout-conformance",
  mode: "time-trial",
  title: "Contrarreloj timeout de conformidad",
  globalTimeLimitMs: 3000,
  questions: timeTrialQueensQuestions,
});
