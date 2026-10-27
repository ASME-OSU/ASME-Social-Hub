# October 27 posting delay

All times below are EDT (America/New_York).

The Bridge Building Competition feed post and initial GroupMe announcement were scheduled for October 27 at noon. Both were processed by the recovery run around 12:53 p.m., approximately 53 minutes late.

## Evidence

- [11:48 a.m. scheduled dispatch](https://github.com/ASME-OSU/ASME-Social-Hub/actions/runs/40534629329): dispatcher logged `actions: []` and `failures: []` at 15:48:36 UTC. The noon actions were not due yet.
- No Dispatch campaigns or Insights run appears between that pass and the recovery run in the inspected GitHub run history. Expected primary dispatch slots included 12:07 and 12:37; scheduled Insights also had a 12:19 slot.
- [12:52 p.m. watchdog](https://github.com/ASME-OSU/ASME-Social-Hub/actions/runs/40545184592): requested a live dispatcher at 16:52:46 UTC after finding the heartbeat overdue.
- [Recovery dispatch](https://github.com/ASME-OSU/ASME-Social-Hub/actions/runs/40545215174): created at 16:52:46 UTC, entered dispatch at 16:52:58 UTC, and reported a feed publish and GroupMe announcement with `fireAt: 2026-10-27T16:00:00.000Z`, with no failures. Dispatch output completed at 16:53:14 UTC.
- Current public campaign receipts record Instagram media ID `18121195540950736` and a GroupMe `botSentAt` for that pass. The receipt timestamps use the dispatcher's captured start time; they are not precise provider delivery times.

## Diagnosis and change

The observed delay occurred before a posting workflow started. There is no evidence of a publishing API failure or a retry of an ambiguous write in this incident. The watchdog caused the apparent spontaneous recovery. GitHub does not expose a reason for each absent scheduled event; delayed or dropped schedule delivery is consistent with this history and [GitHub's documented schedule limitations](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows).

The previous watchdog ran hourly at minute 49 and waited for a 30-minute-old successful heartbeat. After review with Claude in Chrome, the final patch schedules lightweight checks every 10 minutes at :02/:12/:22/:32/:42/:52, allows 40 minutes before treating a heartbeat as stale, and independently throttles dispatch requests for 20 minutes. A threshold below the normal 30-minute primary cadence would create redundant full publishing/build/deploy passes, so the initial 5-minute/10-minute proposal and subsequent 10-minute/20-minute proposal were rejected. Existing serialization, active-run suppression, preview defaults, and publication intent checkpoints remain in place.

Regression tests verify zero recovery requests throughout 48 hours of healthy half-hour passes, independent staleness/cooldown boundaries, and the incident timeline: a punctual 12:22 check waits, while a punctual 12:32 check requests recovery. This is a hypothetical earlier recovery opportunity, not proof that GitHub would deliver that scheduled check.

[Claude review](https://claude.ai/chat/f7127f98-6c4a-4a08-af26-44ea91f7f78b) recommended separating any due-aware gate or no-op deployment optimization from this patch. I agree: changing receipt/freshness handling requires separate validation. External scheduling remains an option if missed runs persist, with additional credential and officer-handoff obligations; it is not being provisioned here.

This is a mitigation, not a guarantee that GitHub will deliver scheduled events promptly. The same watchdog can run on an independent external timer; setup is documented in SETUP.md. That timer still requires external provisioning and credentials.

## Validation

All 18 focused watchdog, dispatch-workflow, and dispatcher-health tests passed. `git diff --check` passed. The broader `npm test` run was stopped after it ceased producing output following 157 passing tests on the revised patch; no full-suite completion is claimed.
