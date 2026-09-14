export const CURRENT_QUESTION_PAYLOAD_SCHEMA_VERSION = 1 as const;
export const CURRENT_CONFIG_SCHEMA_VERSION = 1 as const;

export const SUPPORTED_QUESTION_PAYLOAD_SCHEMA_VERSIONS = [
  CURRENT_QUESTION_PAYLOAD_SCHEMA_VERSION,
] as const;
export const SUPPORTED_CONFIG_SCHEMA_VERSIONS = [CURRENT_CONFIG_SCHEMA_VERSION] as const;

type ContractKind = "question-payload" | "challenge-config";

export class UnsupportedContentContractVersionError extends Error {
  readonly code = "unsupported_content_contract_version";

  constructor(
    readonly kind: ContractKind,
    readonly version: number,
  ) {
    super(`Unsupported ${kind} schema version: ${version}`);
    this.name = "UnsupportedContentContractVersionError";
  }
}

function isSupported(version: number, supported: readonly number[]) {
  return Number.isInteger(version) && supported.some((candidate) => candidate === version);
}

export function isSupportedQuestionPayloadSchemaVersion(version: number) {
  return isSupported(version, SUPPORTED_QUESTION_PAYLOAD_SCHEMA_VERSIONS);
}

export function isSupportedConfigSchemaVersion(version: number) {
  return isSupported(version, SUPPORTED_CONFIG_SCHEMA_VERSIONS);
}

export function assertSupportedQuestionPayloadSchemaVersion(version: number): void {
  if (!isSupportedQuestionPayloadSchemaVersion(version)) {
    throw new UnsupportedContentContractVersionError("question-payload", version);
  }
}

export function assertSupportedConfigSchemaVersion(version: number): void {
  if (!isSupportedConfigSchemaVersion(version)) {
    throw new UnsupportedContentContractVersionError("challenge-config", version);
  }
}
