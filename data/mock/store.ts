import { attemptAnswerFixtures, attemptFixtures } from "@/data/mock/attemptFixtures";
import {
  challengeDefinitions,
  challengeItems,
  challengeVersions,
} from "@/data/mock/challengeFixtures";
import { questionDefinitions, questionVersions } from "@/data/mock/questionFixtures";
import {
  platformRoleAssignments,
  players,
  roomInvitations,
  roomMemberships,
  rooms,
  scheduledChallenges,
  seasons,
} from "@/data/mock/socialFixtures";
import type { DomainStore } from "@/types/domain";

export type MockDomainStore = DomainStore;

export const mockDomainStore = {
  players,
  platformRoleAssignments,
  rooms,
  roomMemberships,
  roomInvitations,
  seasons,
  challengeDefinitions,
  challengeVersions,
  challengeItems,
  questionDefinitions,
  questionVersions,
  scheduledChallenges,
  attempts: attemptFixtures,
  attemptAnswers: attemptAnswerFixtures,
} satisfies MockDomainStore;
