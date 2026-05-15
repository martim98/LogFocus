import test from "node:test";
import assert from "node:assert/strict";
import { createDayCoachMemory } from "../lib/analytics.ts";
import { createCoachDispatchGate, getCoachCueDispatchKey, readCoachDispatchLedger } from "../lib/coach-dispatch.ts";

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
