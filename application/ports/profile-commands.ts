import type { UserProfile } from "@/types/view-models/user";

export type UpdateProfileNameInput = {
  readonly name: string;
};

export type ProfileCommandResult = {
  readonly profile: UserProfile;
};

export interface ProfileCommands {
  updateName(input: UpdateProfileNameInput): Promise<ProfileCommandResult>;
}
