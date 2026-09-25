const namespace = "the-flash-game:s08";

export const scenario = {
  id: "s08",
  namespace,
  users: [
    { label: "superadmin", displayName: "Operador S08" },
    { label: "owner", displayName: "Owner S08" },
    { label: "admin", displayName: "Admin S08" },
    { label: "member", displayName: "Member S08" },
    { label: "spectator", displayName: "Spectator S08" },
    { label: "outsider", displayName: "Outsider S08" },
  ],

  buildDomainSql({ accounts, sqlString }) {
    return `
begin;
insert into private.platform_role_assignments (player_id, role)
values (${sqlString(accounts.superadmin.playerId)}, 'superadmin');
commit;
`;
  },

  manifest({ accounts }) {
    return {
      title: "Sala S08 Beta",
      ownerEmail: accounts.owner.email,
      memberEmails: [
        { email: accounts.admin.email, role: "admin" },
        { email: accounts.member.email, role: "member" },
        { email: accounts.spectator.email, role: "spectator" },
      ],
    };
  },
};

export default scenario;
