import { sessionFixture } from "./competitive-session-fixture.mjs";

function squareQuestion(size, points, question) {
  const pairs = Array.from({ length: size }, (_, row) => ({
    id: `pair-${row + 1}`,
    label: `Pareja ${row + 1}`,
    symbol: String(row + 1),
    endpoints: [row * size, row * size + size - 1],
  }));
  const paths = Object.fromEntries(
    pairs.map((pair, row) => [
      pair.id,
      Array.from({ length: size }, (_, column) => row * size + column),
    ]),
  );

  return {
    type: "connect-pairs",
    points,
    timeLimitMs: 1000,
    publicPayload: {
      question,
      grid: { rows: size, columns: size },
      pairs,
      requireFullCoverage: true,
    },
    solution: { paths },
  };
}

// The sequence deliberately mixes dimensions while keeping one global clock.
export const connectPairsQuestions = [
  squareQuestion(4, 30, "Conecta las parejas y cubre el tablero. (4×4)"),
  squareQuestion(6, 70, "Encuentra otra distribución de caminos. (6×6)"),
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
