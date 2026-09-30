export interface PrivateQuestionAssetResolver {
  resolve(input: {
    authUserId: string;
    attemptId: string;
    publicPayload: unknown;
  }): Promise<unknown>;
}
