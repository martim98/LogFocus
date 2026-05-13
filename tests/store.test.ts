import test from "node:test";
import assert from "node:assert/strict";
import { defaultSettings } from "../lib/domain.ts";
import { getElapsedSeconds, useAppStore } from "../lib/store.ts";

function resetAppStore() {
  useAppStore.setState({
    activeProjectId: null,
    activeTaskId: null,
    activeTaskName: null,
    activeTodoItemId: null,
    activeTodoItemTitle: null,
    timer: {
      mode: "focus",
      remainingSec: 25 * 60,
      isRunning: false,
      startedAt: null,
      cycleCount: 0,
      activeSessionId: null,
    },
  });
}

test("getElapsedSeconds returns wall-clock elapsed seconds", () => {
  assert.equal(getElapsedSeconds("2026-05-11T10:00:00.000Z", Date.parse("2026-05-11T10:06:00.000Z")), 360);
});

test("completeTimer records elapsed segment duration instead of full planned block", () => {
  resetAppStore();
  const originalDate = Date;
  const fixedNow = Date.parse("2026-05-11T10:06:00.000Z");

  class MockDate extends Date {
    constructor(value?: ConstructorParameters<typeof Date>[0]) {
      super(value ?? fixedNow);
    }

    static now() {
      return fixedNow;
    }
  }

  globalThis.Date = MockDate as DateConstructor;

  try {
    useAppStore.setState({
      timer: {
        mode: "focus",
        remainingSec: 60,
        isRunning: true,
        startedAt: "2026-05-11T10:00:00.000Z",
        cycleCount: 0,
        activeSessionId: "session_partial_complete",
      },
    });

    const session = useAppStore.getState().completeTimer(defaultSettings);

    assert.equal(session.plannedDurationSec, 25 * 60);
    assert.equal(session.actualDurationSec, 6 * 60);
    assert.equal(session.startedAt, "2026-05-11T10:00:00.000Z");
    assert.equal(session.endedAt, "2026-05-11T10:06:00.000Z");
    assert.equal(session.completed, true);
  } finally {
    globalThis.Date = originalDate;
    resetAppStore();
  }
});
