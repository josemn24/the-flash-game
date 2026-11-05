import { describe, expect, it, vi } from "vitest";
import { BETAVIP_ACCOUNT_DEFINITIONS } from "../bootstrap-staging.mjs";
import { TABARNIA_USERS } from "../seed-tabarnia.mjs";
import { ensureStagingAccounts } from "./staging-bootstrap.mjs";

const projectRef = "staging-ref";
const config = {
  projectRef,
  emails: { xesmona: "xesmona@example.test", ches: "ches@example.test" },
};
const tabarniaDefinitions = TABARNIA_USERS.map((user) => ({
  key: user.label,
  displayName: user.label === "xesmona" ? "Xesmona" : user.displayName,
  email:
    user.label === "xesmona"
      ? config.emails.xesmona
      : user.label === "ches"
        ? config.emails.ches
        : `tabarnia.${user.label}@example.test`,
}));

function accountWorld({ initialCredentials = null, initialUsers = [] } = {}) {
  let credentials = initialCredentials;
  let nextUserId = 1;
  let nextPassword = 1;
  let userClientCount = 0;
  const users = new Map(initialUsers.map((user) => [user.email, structuredClone(user)]));
  const playerIds = new Map();
  const created = [];
  const admin = {
    auth: {
      admin: {
        createUser: vi.fn(async (payload) => {
          const user = {
            id: `auth-${nextUserId++}`,
            email: payload.email,
            app_metadata: payload.app_metadata,
            user_metadata: payload.user_metadata,
          };
          users.set(user.email, user);
          created.push(user);
          return { data: { user }, error: null };
        }),
      },
    },
  };
  const dependencies = {
    readCredentials: async () => (credentials ? structuredClone(credentials) : null),
    writeCredentials: async (_path, value) => {
      credentials = structuredClone(value);
    },
    adminClient: () => admin,
    findAuthUserByEmail: async (_client, email) => users.get(email) ?? null,
    generatePassword: () => `random-password-${nextPassword++}`,
    userClient: () => {
      userClientCount += 1;
      let signedInUser;
      return {
        auth: {
          signInWithPassword: async ({ email, password }) => {
            const user = users.get(email);
            const saved = credentials?.users?.[user?.user_metadata?.display_name?.toLowerCase()];
            const expectedPassword = Object.values(credentials?.users ?? {}).find(
              (entry) => entry.authUserId === user?.id,
            )?.password;
            if (!user || expectedPassword !== password || (saved && saved.password !== password)) {
              return { error: new Error("invalid credentials") };
            }
            signedInUser = user;
            return { error: null };
          },
        },
        rpc: async () => {
          let playerId = playerIds.get(signedInUser.id);
          if (!playerId) {
            playerId = `player-${signedInUser.id}`;
            playerIds.set(signedInUser.id, playerId);
          }
          return { data: { player_id: playerId }, error: null };
        },
      };
    },
  };
  return {
    dependencies,
    admin,
    users,
    created,
    get credentials() {
      return credentials;
    },
    get userClientCount() {
      return userClientCount;
    },
  };
}

async function provisionScenario(world, scenario) {
  const definitions = scenario === "betavip" ? BETAVIP_ACCOUNT_DEFINITIONS : tabarniaDefinitions;
  return ensureStagingAccounts(config, definitions, {
    credentialsPath: "/tmp/bootstrap-credentials.json",
    dependencies: world.dependencies,
  });
}

describe("shared staging account registry", () => {
  it.each([
    ["BetaVIP then Tabarnia", ["betavip", "tabarnia"]],
    ["Tabarnia then BetaVIP", ["tabarnia", "betavip"]],
  ])(
    "reuses Xesmona and Ches when bootstraps run in either order and repeat: %s",
    async (_, order) => {
      const world = accountWorld();
      let sharedIdentity;
      for (const scenario of [...order, ...order]) {
        const { accounts } = await provisionScenario(world, scenario);
        if (!sharedIdentity) {
          sharedIdentity = Object.fromEntries(
            ["xesmona", "ches"].map((key) => [
              key,
              [accounts[key].authUserId, accounts[key].playerId],
            ]),
          );
        }
        expect(
          Object.fromEntries(
            ["xesmona", "ches"].map((key) => [
              key,
              [accounts[key].authUserId, accounts[key].playerId],
            ]),
          ),
        ).toEqual(sharedIdentity);
      }

      expect(world.created).toHaveLength(16);
      expect(world.users.size).toBe(16);
      expect(Object.keys(world.credentials.users)).toHaveLength(16);
      expect(world.userClientCount).toBe(2 * (2 + tabarniaDefinitions.length));
      expect(world.credentials.users.xesmona.email).toBe(config.emails.xesmona);
      expect(world.credentials.users.ches.email).toBe(config.emails.ches);
      for (const key of ["xesmona", "ches"]) {
        expect(world.created.filter((user) => user.email === config.emails[key])).toHaveLength(1);
      }
    },
  );

  it("rejects an existing Auth account owned outside this bootstrap", async () => {
    const world = accountWorld({
      initialUsers: [{ id: "unmanaged", email: config.emails.xesmona, app_metadata: {} }],
    });
    await expect(provisionScenario(world, "betavip")).rejects.toThrow(/no se puede reutilizar/);
    expect(world.created).toHaveLength(0);
    expect(world.credentials).toBeNull();
  });

  it("rejects a bootstrap-owned account when its password is absent from the credential store", async () => {
    const world = accountWorld({
      initialUsers: [
        {
          id: "owned-but-unrecoverable",
          email: config.emails.xesmona,
          app_metadata: { staging_bootstrap: { project_ref: projectRef, version: 1 } },
        },
      ],
    });
    await expect(provisionScenario(world, "betavip")).rejects.toThrow(/no se puede reutilizar/);
    expect(world.created).toHaveLength(0);
  });

  it("rejects a credential file belonging to a different Supabase project", async () => {
    const world = accountWorld({
      initialCredentials: { version: 1, projectRef: "another-project", users: {} },
    });
    await expect(provisionScenario(world, "betavip")).rejects.toThrow(/no corresponde/);
    expect(world.admin.auth.admin.createUser).not.toHaveBeenCalled();
  });
});
