import test from "node:test";
import assert from "node:assert/strict";
import {
  createDayCoachMemory,
  evaluateDayCoach,
  type DayCoachEvaluation,
  type LiveBannerAlertEvaluation,
  type LiveBannerPaceSummary,
} from "../lib/analytics.ts";
import {
  createCoachDispatchGate,
  getCoachCueDispatchKey,
  getLeanCoachPriorityCue,
  readCoachDispatchLedger,
} from "../lib/coach-dispatch.ts";

function storageStub(fail = false) {
  const data = new Map<string, string>();
  return {
    data,
    getItem(key: string) {
      if (fail) throw new Error("storage unavailable");
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (fail) throw new Error("storage unavailable");
      data.set(key, value);
    },
  };
}

function dispatchKey(dateKey: string, event = "coachResume", message = "Resume work.") {
  return getCoachCueDispatchKey({
    cueEvent: event,
    spokenMessage: message,
    memory: {
      ...createDayCoachMemory(dateKey),
      lastCueAtMs: new Date(`${dateKey}T10:00:00.000Z`).getTime(),
    },
  });
}

test("coach dispatch gate allows the same cue once", () => {
  const gate = createCoachDispatchGate();
  const storage = storageStub();
  const key = dispatchKey("2026-04-15");

  assert.equal(gate.shouldDispatch({ dateKey: "2026-04-15", dispatchKey: key, storage }), true);
  assert.equal(gate.shouldDispatch({ dateKey: "2026-04-15", dispatchKey: key, storage }), false);
});

test("coach dispatch gate resets when the date changes", () => {
  const gate = createCoachDispatchGate();
  const storage = storageStub();
  const firstKey = dispatchKey("2026-04-15");
  const nextKey = dispatchKey("2026-04-16");

  assert.equal(gate.shouldDispatch({ dateKey: "2026-04-15", dispatchKey: firstKey, storage }), true);
  assert.equal(gate.shouldDispatch({ dateKey: "2026-04-16", dispatchKey: nextKey, storage }), true);
  assert.deepEqual(readCoachDispatchLedger(storage, "2026-04-15").keys, []);
});

test("coach dispatch gate prunes stored keys", () => {
  const gate = createCoachDispatchGate();
  const storage = storageStub();
  const dateKey = "2026-04-15";

  for (let index = 0; index < 60; index += 1) {
    assert.equal(gate.shouldDispatch({ dateKey, dispatchKey: `${dateKey}::coachWork::${index}`, storage }), true);
  }

  const ledger = readCoachDispatchLedger(storage, dateKey);
  assert.equal(ledger.keys.length, 50);
  assert.equal(ledger.keys[0], `${dateKey}::coachWork::10`);
  assert.equal(ledger.keys[49], `${dateKey}::coachWork::59`);
});

test("coach dispatch gate falls back when storage is unavailable", () => {
  const gate = createCoachDispatchGate();
  const storage = storageStub(true);
  const key = dispatchKey("2026-04-15");

  assert.equal(gate.shouldDispatch({ dateKey: "2026-04-15", dispatchKey: key, storage }), true);
  assert.equal(gate.shouldDispatch({ dateKey: "2026-04-15", dispatchKey: key, storage }), false);
});

test("lean coach priority uses configured productivity target for resume cues", () => {
  const pace = coachPace({ liveProductivityScore: 72 });
  const now = new Date("2026-04-15T10:00:00.000Z");
  const onTrackAt70 = evaluateDayCoach({
    pace,
    billingCalendarSummary: calendarSummary(),
    timerIsRunning: false,
    now,
    productivityTargetRate: 0.7,
    memory: createDayCoachMemory("2026-04-15"),
  });
  const belowTargetAt75 = evaluateDayCoach({
    pace,
    billingCalendarSummary: calendarSummary(),
    timerIsRunning: false,
    now,
    productivityTargetRate: 0.75,
    memory: createDayCoachMemory("2026-04-15"),
  });

  assert.equal(getLeanCoachPriorityCue(priorityParams(onTrackAt70, { productivityTargetRate: 0.7 })), null);
  assert.equal(
    getLeanCoachPriorityCue(priorityParams(belowTargetAt75, { productivityTargetRate: 0.75 }))?.message,
    "Resume work. Focus remains and live score is below 75 percent.",
  );
});

test("lean coach priority lets resume win over break and status cues", () => {
  const coach = coachEvaluation({
    cueEvent: "coachResume",
    spokenMessage: "Resume work. Focus remains and live score is below 70 percent.",
    title: "Resume",
  });
  const cue = getLeanCoachPriorityCue(
    priorityParams(coach, {
      alertEvaluation: alertEvaluation(["breakRecommended20"]),
      lastDispatchedAtMs: new Date("2026-04-15T08:00:00.000Z").getTime(),
      now: new Date("2026-04-15T10:00:00.000Z"),
    }),
  );

  assert.equal(cue?.event, "coachResume");
});

test("lean coach priority emits only highest break threshold cue", () => {
  const cue = getLeanCoachPriorityCue(
    priorityParams(coachEvaluation(), {
      alertEvaluation: alertEvaluation(["breakRecommended10", "breakRecommended15", "breakRecommended20"]),
    }),
  );

  assert.equal(cue?.event, "breakRecommended20");
  assert.equal(cue?.message, "Break available. You have about 20 free minutes.");
});

test("lean coach priority sends status only after quiet period", () => {
  const now = new Date("2026-04-15T10:00:00.000Z");
  const recent = getLeanCoachPriorityCue(
    priorityParams(coachEvaluation(), {
      lastDispatchedAtMs: new Date("2026-04-15T09:15:00.000Z").getTime(),
      now,
    }),
  );
  const quiet = getLeanCoachPriorityCue(
    priorityParams(coachEvaluation(), {
      lastDispatchedAtMs: new Date("2026-04-15T08:30:00.000Z").getTime(),
      now,
    }),
  );

  assert.equal(recent, null);
  assert.equal(quiet?.event, "coachStatus");
  assert.match(quiet?.message ?? "", /Live score 72 percent/);
  assert.match(quiet?.message ?? "", /2\.1 hours left/);
});

test("lean coach priority suppresses generic work catch-up and done cues", () => {
  for (const cueEvent of ["coachWork", "coachCatchUp", "coachDone"] as const) {
    const cue = getLeanCoachPriorityCue(priorityParams(coachEvaluation({ cueEvent, spokenMessage: "Ignored." })));
    assert.equal(cue, null);
  }
});

function coachPace(overrides: Partial<LiveBannerPaceSummary> = {}): LiveBannerPaceSummary {
  return {
    dateKey: "2026-04-15",
    weekStartDateKey: "2026-04-11",
    weekEndDateKey: "2026-04-17",
    weeklyPlannedHours: 40,
    weeklyRoundedBillableTargetHours: 34,
    roundedBillableLoggedBeforeTodayHours: 13,
    remainingRoundedBillableWeekHours: 21,
    remainingScheduledWorkdays: 3,
    roundedBillableNeededTodayHours: 7,
    todayRoundedBillableHours: 2.3334,
    rawFocusTargetTodayHours: 5,
    todayLoggedRawFocusHours: 2.9,
    rawFocusRemainingTodayHours: 2.1,
    liveProductivityScore: 72,
    finishAt: new Date("2026-04-15T16:30:00.000Z"),
    ...overrides,
  };
}

function alertEvaluation(events: LiveBannerAlertEvaluation["events"] = []): LiveBannerAlertEvaluation {
  return {
    events,
    memory: {
      dateKey: "2026-04-15",
      firedEvents: events,
      earliestFinishAtMs: null,
      idleStartedAtMs: null,
    },
    breakSignal: {
      active: events.some((event) => event.startsWith("breakRecommended")),
      gapHours: 20 / 60,
      freeMinutes: 20,
      label: events.some((event) => event.startsWith("breakRecommended")) ? "Break recommended" : "Balanced",
      helper: null,
    },
  };
}

function coachEvaluation(overrides: Partial<DayCoachEvaluation> = {}): DayCoachEvaluation {
  return {
    state: "work",
    title: "Work",
    message: "Keep working",
    helper: "On track",
    severity: "neutral",
    nextCueAt: null,
    cueEvent: null,
    spokenMessage: null,
    memory: {
      ...createDayCoachMemory("2026-04-15"),
      lastCueAtMs: new Date("2026-04-15T10:00:00.000Z").getTime(),
    },
    ...overrides,
  };
}

function calendarSummary() {
  return {
    startDateKey: "2026-04-11",
    endDateKey: "2026-04-17",
    carryInStartDateKey: "2026-04-11",
    carryInEndDateKey: "2026-04-14",
    finalScheduledDateKey: "2026-04-17",
    carryInBillableHours: 0,
    carryInRawHours: 0,
    currentPlannedHours: 40,
    totalPlannedHours: 40,
    totalTargetBillableHours: 34,
    totalBillableHours: 10,
    totalRawBillableHours: 10,
    remainingToTargetHours: 24,
    tomorrowStartBillableHours: null,
    rows: [
      {
        kind: "day" as const,
        dateKey: "2026-04-15",
        label: "Wed",
        weekdayKey: "wed" as const,
        openingBillableHours: 0,
        plannedHours: 8,
        cumulativePlannedHours: 24,
        targetBillableHours: 6.8,
        rawBillableHours: 2,
        billableHours: 2,
        cumulativeBillableHours: 10,
        cumulativeTargetBillableHours: 20.4,
        billablePercent: 25,
        remainingToTargetHours: 0,
        isToday: true,
        isFuture: false,
        isOverride: false,
      },
    ],
  };
}

function priorityParams(
  coachEvaluationValue: DayCoachEvaluation,
  overrides: Partial<Parameters<typeof getLeanCoachPriorityCue>[0]> = {},
): Parameters<typeof getLeanCoachPriorityCue>[0] {
  return {
    pace: coachPace(),
    coachEvaluation: coachEvaluationValue,
    alertEvaluation: alertEvaluation(),
    productivityTargetRate: 0.7,
    lastDispatchedAtMs: null,
    now: new Date("2026-04-15T10:00:00.000Z"),
    ...overrides,
  };
}
