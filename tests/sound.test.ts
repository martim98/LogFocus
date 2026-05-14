import test from "node:test";
import assert from "node:assert/strict";
import { getSpokenAlertMessage } from "../lib/sound.ts";

test("spoken alert messages include dynamic break-ahead amount", () => {
  assert.equal(
    getSpokenAlertMessage("breakRecommended", { billableAheadGapHours: 0.86 }),
    "Break recommended. Billable is 0.9 hours ahead of raw focus.",
  );
});

test("spoken alert messages cover focus and billing events", () => {
  assert.equal(getSpokenAlertMessage("focus75"), "Seventy five percent focus target reached.");
  assert.equal(getSpokenAlertMessage("rawFocusDone"), "Raw focus target complete.");
  assert.equal(getSpokenAlertMessage("billableDone"), "Billable need reached.");
  assert.equal(getSpokenAlertMessage("finishSlip"), "Finish by is slipping.");
  assert.equal(getSpokenAlertMessage("idle"), "Idle reminder. Focus time remains.");
});

test("spoken alert messages support custom coach cue text", () => {
  assert.equal(
    getSpokenAlertMessage("coachWork", { spokenMessage: "Work. Keep working. Finish-by is on track." }),
    "Work. Keep working. Finish-by is on track.",
  );
});

test("spoken alert messages include concise coach defaults", () => {
  assert.equal(getSpokenAlertMessage("coachWork"), "Keep working.");
  assert.equal(getSpokenAlertMessage("coachResume"), "Resume work.");
  assert.equal(getSpokenAlertMessage("coachDone"), "Done for today. Required focus is complete.");
  assert.equal(getSpokenAlertMessage("coachCatchUp"), "Catch up with focused work.");
});
