import test from "node:test";
import assert from "node:assert/strict";
import {
  awardFocusSessionReward,
  calculateSessionRewardMinutes,
  deriveFocusRewardBalance,
  getEffectiveRewardTargetRate,
  getStretchTargetOffer,
  normalizeLedgerForDate,
  removeFocusSessionReward,
  spendFocusRewardMinutes,
} from "../lib/focus-rewards.ts";
import { createDefaultFocusRewardLedger, defaultSettings } from "../lib/domain.ts";
import type { FocusSession } from "../lib/domain.ts";

function session(id: string, actualDurationSec: number): FocusSession {
  return {
    id,
    mode: "focus",
    projectId: null,
    projectName: null,
    taskId: null,
    todoItemId: null,
    taskName: null,
    startedAt: "2026-05-08T09:00:00.000Z",
    endedAt: "2026-05-08T09:30:00.000Z",
    plannedDurationSec: actualDurationSec,
    actualDurationSec,
    completed: true,
    interrupted: false,
  };
}

test("focus reward calculation uses minimum threshold and floor ratio", () => {
  assert.equal(calculateSessionRewardMinutes(session("s4", 4 * 60), defaultSettings), 0);
  assert.equal(calculateSessionRewardMinutes(session("s5", 5 * 60), defaultSettings), 2);
  assert.equal(calculateSessionRewardMinutes(session("s24", 24 * 60), defaultSettings), 10);
});

test("daily cap prevents over-earning", () => {
  const ledger = {
    ...createDefaultFocusRewardLedger(),
    earnedTodayDate: "2026-05-08",
    earnedTodayMinutes: 44,
    bankMinutes: 44,
  };

  const next = awardFocusSessionReward(ledger, session("cap", 25 * 60), defaultSettings, "2026-05-08T10:00:00.000Z");
  assert.equal(next.awardedSessions.cap.minutes, 1);
  assert.equal(next.earnedTodayMinutes, 45);
  assert.equal(next.bankMinutes, 45);
});

test("max bank prevents overflow", () => {
  const ledger = {
    ...createDefaultFocusRewardLedger(),
    earnedTodayDate: "2026-05-08",
    bankMinutes: 59,
  };

  const next = awardFocusSessionReward(ledger, session("bank", 25 * 60), defaultSettings, "2026-05-08T10:00:00.000Z");
  assert.equal(next.awardedSessions.bank.minutes, 1);
  assert.equal(next.bankMinutes, 60);
});

test("re-saving the same session does not double-award", () => {
  const first = awardFocusSessionReward(createDefaultFocusRewardLedger(), session("same", 25 * 60), defaultSettings, "2026-05-08T09:25:00.000Z");
  const second = awardFocusSessionReward(first, session("same", 25 * 60), defaultSettings, "2026-05-08T09:25:00.000Z");

  assert.equal(first.bankMinutes, 10);
  assert.equal(second.bankMinutes, 10);
  assert.equal(second.earnedTodayMinutes, 10);
});

test("editing a session adjusts only the delta", () => {
  const first = awardFocusSessionReward(createDefaultFocusRewardLedger(), session("edit", 25 * 60), defaultSettings, "2026-05-08T09:25:00.000Z");
  const second = awardFocusSessionReward(first, session("edit", 40 * 60), defaultSettings, "2026-05-08T09:40:00.000Z");

  assert.equal(first.bankMinutes, 10);
  assert.equal(second.bankMinutes, 17);
  assert.equal(second.awardedSessions.edit.minutes, 17);
});

test("deleting a rewarded session subtracts safely", () => {
  const awarded = awardFocusSessionReward(createDefaultFocusRewardLedger(), session("delete", 25 * 60), defaultSettings, "2026-05-08T09:25:00.000Z");
  const removed = removeFocusSessionReward(awarded, "delete");
  const removedAgain = removeFocusSessionReward(removed, "delete");

  assert.equal(removed.bankMinutes, 0);
  assert.equal(removed.earnedTodayMinutes, 0);
  assert.equal(removed.awardedSessions.delete, undefined);
  assert.equal(removedAgain.bankMinutes, 0);
});

test("new reward day clears bank and awarded sessions", () => {
  const awarded = {
    ...awardFocusSessionReward(createDefaultFocusRewardLedger(), session("daily", 25 * 60), defaultSettings, "2026-05-08T09:25:00.000Z"),
    targetRateOverrideDate: "2026-05-08",
    targetRateOverride: 0.75,
    targetRateOfferDismissedDate: "2026-05-08",
  };
  const reset = normalizeLedgerForDate(awarded, "2026-05-09");

  assert.equal(awarded.bankMinutes, 10);
  assert.equal(reset.bankMinutes, 0);
  assert.equal(reset.earnedTodayMinutes, 0);
  assert.deepEqual(reset.awardedSessions, {});
  assert.equal(reset.targetRateOverrideDate, null);
  assert.equal(reset.targetRateOverride, null);
  assert.equal(reset.targetRateOfferDismissedDate, null);
});

test("spending after a day change resets instead of carrying old bank", () => {
  const awarded = awardFocusSessionReward(createDefaultFocusRewardLedger(), session("spend_next_day", 25 * 60), defaultSettings, "2026-05-08T09:25:00.000Z");
  const spent = spendFocusRewardMinutes(awarded, 2, "2026-05-09T09:00:00.000Z");

  assert.equal(spent.bankMinutes, -2);
  assert.equal(spent.earnedTodayDate, "2026-05-09");
  assert.deepEqual(spent.awardedSessions, {});
});

test("spending on the same day progressively subtracts from the bank", () => {
  const awarded = awardFocusSessionReward(createDefaultFocusRewardLedger(), session("spend_same_day", 25 * 60), defaultSettings, "2026-05-08T09:25:00.000Z");
  const spent = spendFocusRewardMinutes(awarded, 2, "2026-05-08T10:00:00.000Z");

  assert.equal(awarded.bankMinutes, 10);
  assert.equal(spent.bankMinutes, 8);
  assert.equal(spent.earnedTodayMinutes, 10);
});

test("derived reward balance targets the configured productivity rate from the session log", () => {
  const balance = deriveFocusRewardBalance(
    [session("derived", 30 * 60)],
    createDefaultFocusRewardLedger(),
    defaultSettings,
    "2026-05-08",
    Date.parse("2026-05-08T09:50:00.000Z"),
  );

  assert.equal(balance.focusMinutes, 30);
  assert.equal(balance.elapsedMinutes, 50);
  assert.equal(balance.nonFocusMinutes, 20);
  assert.equal(Number(balance.earnedFreeMinutes.toFixed(2)), 12.86);
  assert.equal(Number(balance.balanceMinutes.toFixed(2)), -7.14);
  assert.equal(Number(balance.recoveryFocusMinutes.toFixed(2)), 16.67);
  assert.equal(balance.targetProductivityRate, 0.7);
});

test("derived reward balance applies a reset offset for the current day", () => {
  const raw = deriveFocusRewardBalance(
    [session("offset", 30 * 60)],
    createDefaultFocusRewardLedger(),
    defaultSettings,
    "2026-05-08",
    Date.parse("2026-05-08T09:50:00.000Z"),
  );
  const ledger = {
    ...createDefaultFocusRewardLedger(),
    balanceOffsetDate: "2026-05-08",
    balanceOffsetMinutes: -raw.rawBalanceMinutes,
  };
  const reset = deriveFocusRewardBalance(
    [session("offset", 30 * 60)],
    ledger,
    defaultSettings,
    "2026-05-08",
    Date.parse("2026-05-08T09:50:00.000Z"),
  );

  assert.equal(Number(raw.balanceMinutes.toFixed(2)), -7.14);
  assert.equal(reset.balanceMinutes, 0);
});

test("effective target uses today's override and ignores stale overrides", () => {
  const ledger = {
    ...createDefaultFocusRewardLedger(),
    targetRateOverrideDate: "2026-05-08",
    targetRateOverride: 0.75,
  };

  assert.equal(getEffectiveRewardTargetRate(defaultSettings, createDefaultFocusRewardLedger(), "2026-05-08"), 0.7);
  assert.equal(getEffectiveRewardTargetRate(defaultSettings, ledger, "2026-05-08"), 0.75);
  assert.equal(getEffectiveRewardTargetRate(defaultSettings, ledger, "2026-05-09"), 0.7);
});

test("derived reward balance uses today's effective target", () => {
  const ledger = {
    ...createDefaultFocusRewardLedger(),
    targetRateOverrideDate: "2026-05-08",
    targetRateOverride: 0.75,
  };
  const balance = deriveFocusRewardBalance(
    [session("override_balance", 30 * 60)],
    ledger,
    defaultSettings,
    "2026-05-08",
    Date.parse("2026-05-08T09:50:00.000Z"),
  );

  assert.equal(Number(balance.earnedFreeMinutes.toFixed(2)), 10);
  assert.equal(Number(balance.balanceMinutes.toFixed(2)), -10);
  assert.equal(Number(balance.recoveryFocusMinutes.toFixed(2)), 30);
  assert.equal(balance.targetProductivityRate, 0.75);
});

test("session rewards use today's effective target", () => {
  const ledger = {
    ...createDefaultFocusRewardLedger(),
    earnedTodayDate: "2026-05-08",
    targetRateOverrideDate: "2026-05-08",
    targetRateOverride: 0.75,
  };

  assert.equal(calculateSessionRewardMinutes(session("override_award", 30 * 60), defaultSettings, ledger), 10);
  assert.equal(calculateSessionRewardMinutes(session("default_award", 30 * 60), defaultSettings), 12);

  const awarded = awardFocusSessionReward(ledger, session("override_award", 30 * 60), defaultSettings, "2026-05-08T09:30:00.000Z");
  assert.equal(awarded.awardedSessions.override_award.minutes, 10);
});

test("stretch target offer uses conservative thresholds and dismissal state", () => {
  const rewardBalance = deriveFocusRewardBalance(
    [session("stretch_offer", 59 * 60)],
    createDefaultFocusRewardLedger(),
    defaultSettings,
    "2026-05-08",
    Date.parse("2026-05-08T09:59:00.000Z"),
  );
  const base = {
    settings: defaultSettings,
    ledger: createDefaultFocusRewardLedger(),
    dateKey: "2026-05-08",
    rewardBalance,
    liveProductivityScore: 78,
    rawFocusRemainingTodayHours: 1,
  };

  const offer = getStretchTargetOffer(base);
  assert.equal(offer?.dateKey, "2026-05-08");
  assert.equal(offer?.currentTargetRate, 0.7);
  assert.equal(Number(offer?.offeredTargetRate.toFixed(3)), 0.747);
  assert.equal(Number(offer?.freeMinutes.toFixed(2)), 25.29);
  assert.equal(offer?.retainedFreeMinutes, 20);
  assert.equal(offer?.convertedFreeMinutes, 5);
  assert.equal(offer?.liveProductivityScore, 78);
  assert.equal(
    getStretchTargetOffer({
      ...base,
      rewardBalance: {
        ...rewardBalance,
        balanceMinutes: 20.99,
      },
    }),
    null,
  );
  assert.equal(getStretchTargetOffer({ ...base, liveProductivityScore: 77.9 }), null);
  assert.equal(getStretchTargetOffer({ ...base, rawFocusRemainingTodayHours: 0.99 }), null);
  assert.equal(
    getStretchTargetOffer({
      ...base,
      ledger: { ...base.ledger, targetRateOfferDismissedDate: "2026-05-08" },
    }),
    null,
  );
  assert.equal(
    getStretchTargetOffer({
      ...base,
      ledger: { ...base.ledger, targetRateOverrideDate: "2026-05-08", targetRateOverride: 0.75 },
    }),
    null,
  );
});

test("stretch target offer can step up again after new surplus under an accepted override", () => {
  const ledger = {
    ...createDefaultFocusRewardLedger(),
    targetRateOverrideDate: "2026-05-08",
    targetRateOverride: 0.72,
  };
  const rewardBalance = deriveFocusRewardBalance(
    [session("stretch_repeat", 250 * 60)],
    ledger,
    defaultSettings,
    "2026-05-08",
    Date.parse("2026-05-08T13:10:00.000Z"),
  );
  const offer = getStretchTargetOffer({
    settings: defaultSettings,
    ledger,
    dateKey: "2026-05-08",
    rewardBalance,
    liveProductivityScore: 78,
    rawFocusRemainingTodayHours: 1,
  });

  assert.equal(offer?.currentTargetRate, 0.72);
  assert.equal(offer?.offeredTargetRate, 0.75);
  assert.equal(offer?.convertedFreeMinutes, 77);
});

test("stretch target offer uses the configured free-minute reserve", () => {
  const rewardBalance = deriveFocusRewardBalance(
    [session("stretch_custom", 73 * 60)],
    createDefaultFocusRewardLedger(),
    { ...defaultSettings, rewardStretchReserveMinutes: 30 },
    "2026-05-08",
    Date.parse("2026-05-08T10:13:00.000Z"),
  );
  const offer = getStretchTargetOffer({
    settings: { ...defaultSettings, rewardStretchReserveMinutes: 30 },
    ledger: createDefaultFocusRewardLedger(),
    dateKey: "2026-05-08",
    rewardBalance,
    liveProductivityScore: 78,
    rawFocusRemainingTodayHours: 1,
  });

  assert.equal(offer?.retainedFreeMinutes, 30);
  assert.equal(offer?.convertedFreeMinutes, 1);
  assert.equal(Number(offer?.offeredTargetRate.toFixed(3)), 0.709);
});
