import type {
  AttemptAnswerId,
  AttemptId,
  AuthUserId,
  ChallengeDefinitionId,
  ChallengeItemId,
  ChallengeVersionId,
  DurationMs,
  PlayerId,
  QuestionDefinitionId,
  QuestionVersionId,
  RoomId,
  RoomInvitationId,
  RoomMembershipId,
  ScheduledChallengeId,
  SeasonId,
  UtcIsoDateTime,
} from "@/types/domain";

const MOCK_NAMESPACE_UUID = "53dcf62d-6d89-50f7-9a34-03fbc01396ae";

function uuidBytes(uuid: string) {
  const hex = uuid.replaceAll("-", "");
  return Uint8Array.from({ length: hex.length / 2 }, (_, index) =>
    Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
  );
}

function formatUuid(bytes: Uint8Array) {
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function rotateLeft(value: number, bits: number) {
  return (value << bits) | (value >>> (32 - bits));
}

// UUID v5 requires SHA-1. This small synchronous implementation keeps mock identity usable in
// browser bundles without importing Node's crypto module.
function sha1(input: Uint8Array) {
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const message = new Uint8Array(paddedLength);
  message.set(input);
  message[input.length] = 0x80;
  const bitLength = input.length * 8;
  const view = new DataView(message.buffer);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const words = new Uint32Array(80);

  for (let offset = 0; offset < message.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 80; index += 1) {
      words[index] =
        rotateLeft(
          words[index - 3] ^ words[index - 8] ^ words[index - 14] ^ words[index - 16],
          1,
        ) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let index = 0; index < 80; index += 1) {
      let f: number;
      let k: number;
      if (index < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (index < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (index < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temporary = (rotateLeft(a, 5) + f + e + k + words[index]) >>> 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30) >>> 0;
      b = a;
      a = temporary;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const digest = new Uint8Array(20);
  const digestView = new DataView(digest.buffer);
  [h0, h1, h2, h3, h4].forEach((word, index) => digestView.setUint32(index * 4, word, false));
  return digest;
}

export function deterministicMockUuid(scope: string, key: string) {
  const namespace = uuidBytes(MOCK_NAMESPACE_UUID);
  const name = new TextEncoder().encode(`${scope}:${key}`);
  const input = new Uint8Array(namespace.length + name.length);
  input.set(namespace);
  input.set(name, namespace.length);
  const digest = sha1(input).slice(0, 16);

  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  return formatUuid(digest);
}

function id<Value extends string>(scope: string, key: string) {
  return deterministicMockUuid(scope, key) as Value;
}

export const mockId = {
  player: (key: string) => id<PlayerId>("player", key),
  authUser: (key: string) => id<AuthUserId>("auth-user", key),
  room: (key: string) => id<RoomId>("room", key),
  roomMembership: (key: string) => id<RoomMembershipId>("room-membership", key),
  roomInvitation: (key: string) => id<RoomInvitationId>("room-invitation", key),
  season: (key: string) => id<SeasonId>("season", key),
  challengeDefinition: (key: string) => id<ChallengeDefinitionId>("challenge-definition", key),
  challengeVersion: (key: string) => id<ChallengeVersionId>("challenge-version", key),
  challengeItem: (key: string) => id<ChallengeItemId>("challenge-item", key),
  questionDefinition: (key: string) => id<QuestionDefinitionId>("question-definition", key),
  questionVersion: (key: string) => id<QuestionVersionId>("question-version", key),
  scheduledChallenge: (key: string) => id<ScheduledChallengeId>("scheduled-challenge", key),
  attempt: (key: string) => id<AttemptId>("attempt", key),
  attemptAnswer: (key: string) => id<AttemptAnswerId>("attempt-answer", key),
} as const;

export function utc(value: string) {
  return value as UtcIsoDateTime;
}

export function durationMs(value: number) {
  return value as DurationMs;
}
