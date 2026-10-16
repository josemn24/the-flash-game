import { sessionFixture } from "./competitive-session-fixture.mjs";
// Curated full-coverage boards. Durations are test data, not editorial calibration.
export const connectPairsQuestions = [
  {
    type: "connect-pairs",
    points: 30,
    timeLimitMs: 1000,
    publicPayload: {
      question: "Conecta las parejas y cubre el tablero.",
      grid: {
        rows: 5,
        columns: 5,
      },
      pairs: [
        {
          id: "a",
          label: "Pareja A",
          symbol: "A",
          endpoints: [0, 4],
        },
        {
          id: "b",
          label: "Pareja B",
          symbol: "B",
          endpoints: [5, 9],
        },
        {
          id: "c",
          label: "Pareja C",
          symbol: "C",
          endpoints: [10, 14],
        },
      ],
      requireFullCoverage: true,
    },
    solution: {
      paths: {
        a: [0, 1, 2, 3, 4],
        b: [5, 6, 7, 8, 9],
        c: [10, 15, 20, 21, 22, 23, 24, 19, 18, 17, 16, 11, 12, 13, 14],
      },
    },
  },
  {
    type: "connect-pairs",
    points: 70,
    timeLimitMs: 1000,
    publicPayload: {
      question: "Encuentra otra distribución de caminos.",
      grid: {
        rows: 5,
        columns: 5,
      },
      pairs: [
        {
          id: "a",
          label: "Pareja A",
          symbol: "A",
          endpoints: [0, 4],
        },
        {
          id: "b",
          label: "Pareja B",
          symbol: "B",
          endpoints: [5, 9],
        },
        {
          id: "c",
          label: "Pareja C",
          symbol: "C",
          endpoints: [10, 14],
        },
      ],
      requireFullCoverage: true,
    },
    solution: {
      paths: {
        a: [0, 1, 2, 3, 4],
        b: [5, 6, 7, 8, 9],
        c: [10, 11, 16, 15, 20, 21, 22, 23, 24, 19, 18, 17, 12, 13, 14],
      },
    },
  },
];
const fixture = sessionFixture({
  id: "time-trial-connect-pairs",
  mode: "time-trial",
  title: "Contrarreloj Conectar parejas",
  globalTimeLimitMs: 120000,
  questions: connectPairsQuestions,
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
