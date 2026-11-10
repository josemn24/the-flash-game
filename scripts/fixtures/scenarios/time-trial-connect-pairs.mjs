import { sessionFixture } from "./competitive-session-fixture.mjs";
import { timeTrialConnectPairsQuestions } from "../../../data/mock/timeTrialFixtures.mjs";

// Preserve the fixture export consumed by its E2E flow.
export const connectPairsQuestions = timeTrialConnectPairsQuestions;

const fixture = sessionFixture({
  id: "time-trial-connect-pairs",
  mode: "time-trial",
  title: "Contrarreloj Conectar parejas",
  globalTimeLimitMs: 120000,
  additionalPlayers: ["conformance"],
  questions: timeTrialConnectPairsQuestions,
});

const scenario = {
  ...fixture,
  buildDomainSql(input) {
    return (
      fixture.buildDomainSql(input) +
      `
insert into private.platform_role_assignments(player_id,role) values (${input.sqlString(input.accounts.dave.playerId)},'superadmin');
`
    );
  },
};

export default scenario;
