import { scenario as s03Scenario } from "./s03.mjs";

const namespace = "the-flash-game:s06";
const labels = {
  room: "s03-room-main",
  season: "s03-season-main",
  challenge: "s03-challenge",
  challengeVersion: "s03-challenge-version",
  challengeItemOne: "s03-challenge-item-one",
  challengeItemTwo: "s03-challenge-item-two",
  publication: "s03-publication",
};

export const scenario = {
  id: "s06",
  namespace,
  users: s03Scenario.users,

  buildDomainSql(args) {
    return s03Scenario.buildDomainSql(args).replaceAll("s03", "s06").replaceAll("S03", "S06");
  },

  manifest({ stableId }) {
    return {
      room: { id: stableId(labels.room), slug: "s06-main" },
      publicationId: stableId(labels.publication),
      challengeId: stableId(labels.challenge),
      challengeVersionId: stableId(labels.challengeVersion),
      challengeItemIds: [stableId(labels.challengeItemOne), stableId(labels.challengeItemTwo)],
    };
  },
};

export default scenario;
