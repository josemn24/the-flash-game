import { sessionFixture } from "./competitive-session-fixture.mjs";
import { timeTrialQueensQuestions } from "../../../data/mock/timeTrialFixtures.mjs";

export default sessionFixture({
  id: "time-trial",
  mode: "time-trial",
  title: "Contrarreloj Queens",
  globalTimeLimitMs: 120000,
  questions: timeTrialQueensQuestions,
});
