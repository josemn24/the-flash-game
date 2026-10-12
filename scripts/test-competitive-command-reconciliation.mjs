import assert from "node:assert/strict";

export function assertReconciledCommandBehavior(observations) {
  const cases = new Map(observations.map(({ id, result }) => [id, result]));
  assert.equal(cases.size, 41, "All reconciliation probes must run");
  for (const [id, { observation, state }] of cases) {
    assert.equal(state.wrapperOidPreserved, true, `${id}: wrapper OID`);
    assert.equal(state.pointEntries, 0, `${id}: no new points`);
    let error;
    if (
      id.startsWith("race/") ||
      id.endsWith("/takeover") ||
      id === "authorize-replay/transferred"
    ) {
      error = ["42501", "session_transferred"];
    } else if (id.startsWith("unknown-token/") || id.startsWith("revoked/")) {
      error = ["42501", "session_revoked"];
    } else if (id.startsWith("takeover/null-") || id === "dispatcher/without-schedule") {
      error = ["22023", "invalid_command"];
    } else if (id === "takeover/cached-after-membership-removal") {
      error = ["42501", "not_authorized"];
    }
    if (error) {
      assert.deepEqual(
        observation,
        { accepted: false, sqlstate: error[0], message: error[1] },
        `${id}: error contract`,
      );
    } else {
      assert.equal(observation.accepted, true, `${id}: acceptance`);
    }
    if (id.startsWith("closure/") || id === "expiration/inactivity") {
      const reason = id.startsWith("closure/") ? id.slice(8) : "inactivity_timeout";
      assert.equal(state.attempt.status, "abandoned", `${id}: terminal status`);
      assert.equal(state.attempt.terminalReason, reason, `${id}: terminal reason`);
      assert.deepEqual(
        state.sessions,
        [{ revoked: true, reason: reason === "permission_revoked" ? reason : "terminal" }],
        `${id}: session closure reason`,
      );
      assert.equal(state.audit.length, 1, `${id}: one audit event`);
      if (id === "expiration/inactivity") {
        assert.equal(observation.abandonedAttempts, 1);
        assert.match(
          state.audit[0].requestId,
          /^audit-inactivity:inactivity_timeout:[0-9a-f-]{36}$/,
        );
      }
    }
    if (id.startsWith("race/") || (observation.accepted && observation.transferred)) {
      assert.equal(state.attempt.lockVersion, 2, `${id}: one version increment`);
      assert.deepEqual(
        state.sessions,
        [
          { revoked: false, reason: null },
          { revoked: true, reason: "takeover" },
        ],
        `${id}: one active controller`,
      );
      assert.equal(state.audit.length, 1, `${id}: one transfer audit event`);
      assert.equal(state.audit[0].action, "takeover_confirmed", `${id}: audit action`);
      assert.deepEqual(
        state.audit[0].beforeKeys,
        ["deadlineAt", "lockVersion", "score", "status"],
        `${id}: preserve transfer audit metadata`,
      );
    }
  }
  console.log("41 reconciliation contracts passed, including six concurrent transfer races.");
}
