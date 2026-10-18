import { registerTimeTrialConformance } from "./support/time-trial-conformance";

registerTimeTrialConformance({
  scenario: "time-trial-timeout-conformance",
  format: "queens",
  timeout: true,
});
