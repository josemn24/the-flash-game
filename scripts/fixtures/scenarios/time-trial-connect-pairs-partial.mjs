import { sessionFixture } from "./competitive-session-fixture.mjs";
import { connectPairsTimeoutQuestions } from "../../../data/mock/timeTrialFixtures.mjs";

export default sessionFixture({
  id: "time-trial-connect-pairs-partial",
  mode: "time-trial",
  title: "Contrarreloj con puntos parciales",
  globalTimeLimitMs: 12000,
  modeConfig: { connectPairsTimeoutPartialCredit: true },
  questions: connectPairsTimeoutQuestions,
});
