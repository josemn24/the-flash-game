import type { AuthenticationResult, SignInCredentials } from "@/types/contracts/authentication";

export interface AuthenticationGateway {
  signIn(credentials: SignInCredentials): Promise<AuthenticationResult>;
  signOut(): Promise<AuthenticationResult>;
}
