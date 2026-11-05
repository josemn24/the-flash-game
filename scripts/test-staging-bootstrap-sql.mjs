import { buildStagingBetaVipDomainSql, stagingBetaVipManifest } from "./seed-betavip.mjs";
import {
  buildTabarniaDomainSql,
  getAvatarMetadata,
  getSbrMapMetadata,
  prepareSpainAssets,
  TABARNIA_USERS,
  tabarniaManifest,
} from "./seed-tabarnia.mjs";
import { sqlString } from "./support/supabase-local.mjs";

function testAccounts() {
  return Object.fromEntries(
    TABARNIA_USERS.map((user, index) => [
      user.label,
      {
        email:
          user.label === "xesmona"
            ? "xesmona@staging.example.test"
            : user.label === "ches"
              ? "ches@staging.example.test"
              : `tabarnia.${user.label}@example.test`,
        playerId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      },
    ]),
  );
}

function authFixtureSql(accounts) {
  const authUsers = TABARNIA_USERS.map((user, index) => {
    const authId = `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    return `(${sqlString(authId)}, ${sqlString(accounts[user.label].email)})`;
  }).join(",\n");
  const players = TABARNIA_USERS.map((user, index) => {
    const authId = `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    return `(${sqlString(accounts[user.label].playerId)}, ${sqlString(authId)}, ${sqlString(user.displayName)})`;
  }).join(",\n");
  return `
insert into auth.users (id, email) values ${authUsers};
insert into public.players (id, auth_user_id, display_name) values ${players};
`;
}

export async function testStagingBootstrapSql(sql) {
  const accounts = testAccounts();
  const data = tabarniaManifest(
    accounts,
    Object.fromEntries(
      TABARNIA_USERS.filter((user) => user.avatarFile).map((user) => [
        user.label,
        { extension: user.avatarFile.split(".").pop() },
      ]),
    ),
  );
  const betaVip = stagingBetaVipManifest();
  const spain = await prepareSpainAssets();
  try {
    const avatarMetadata = Object.fromEntries(
      await Promise.all(
        TABARNIA_USERS.filter((user) => user.avatarFile).map(async (user) => [
          user.label,
          await getAvatarMetadata(user),
        ]),
      ),
    );
    const tabarniaSql = buildTabarniaDomainSql({
      accounts,
      sbrAssetMetadata: await getSbrMapMetadata(),
      spainAssets: spain.assets,
      avatarMetadata,
      conflictSafe: true,
      wrapTransaction: false,
    });
    const betaVipSql = buildStagingBetaVipDomainSql({
      xesmonaPlayerId: accounts.xesmona.playerId,
      chesPlayerId: accounts.ches.playerId,
      cassetteAssetMetadata: { byteSize: 1024, sha256: "c".repeat(64) },
    });
    const accountSetup = authFixtureSql(accounts);
    const countsCheck = `
do $$ begin
  if (select count(*) from auth.users where id::text like '20000000-0000-4000-8000-%') <> 16 then
    raise exception 'expected exactly sixteen staging test identities';
  end if;
  if (select count(*) from public.players where id::text like '10000000-0000-4000-8000-%') <> 16 then
    raise exception 'expected exactly sixteen staging test players';
  end if;
  if (select count(*) from public.rooms where slug in ('beta-vip', 'tabarnia')) <> 2 then
    raise exception 'expected both scenario rooms exactly once';
  end if;
  if (select count(*) from public.room_memberships where room_id = '${data.room.id}') <> 15 then
    raise exception 'expected fifteen active Tabarnia members';
  end if;
  if (select count(*) from public.room_memberships where room_id = '${betaVip.room.id}') <> 1 then
    raise exception 'expected one BetaVIP owner';
  end if;
  if (select count(*) from public.scheduled_challenges where season_id = '${data.seasonId}') <> 8 then
    raise exception 'expected eight Tabarnia publications';
  end if;
  if (select count(*) from public.scheduled_challenges where season_id = '${betaVip.seasonId}') <> 5 then
    raise exception 'expected five BetaVIP publications';
  end if;
  if (select count(*) from public.room_memberships where room_id in ('${data.room.id}', '${betaVip.room.id}') and player_id = '${accounts.ches.playerId}' and role = 'owner') <> 2 then
    raise exception 'Ches must own both scenario rooms';
  end if;
end $$;
`;

    for (const order of [
      ["BetaVIP", betaVipSql, "Tabarnia", tabarniaSql],
      ["Tabarnia", tabarniaSql, "BetaVIP", betaVipSql],
    ]) {
      const [firstName, firstSql, secondName, secondSql] = order;
      const checkpoint = (label) => `do $$ begin raise notice '${label}'; end $$;`;
      try {
        await sql(
          `begin;\n${accountSetup}\n${checkpoint(`first ${firstName}`)}\n${firstSql}\n${checkpoint(`then ${secondName}`)}\n${secondSql}\n${checkpoint(`repeat ${firstName}`)}\n${firstSql}\n${checkpoint(`repeat ${secondName}`)}\n${secondSql}\n${countsCheck}\nrollback;`,
        );
      } catch (error) {
        throw new Error(
          `Staging bootstrap order ${firstName} then ${secondName} failed: ${error.message}`,
          {
            cause: error,
          },
        );
      }
    }
    return { scenarios: 2, orders: ["BetaVIP → Tabarnia", "Tabarnia → BetaVIP"], repeats: 2 };
  } finally {
    await spain.cleanup();
  }
}
