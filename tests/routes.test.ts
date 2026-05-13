import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

const originalCwd = process.cwd();
const tempDir = await mkdtemp(path.join(os.tmpdir(), "logfocus-route-test-"));
process.chdir(tempDir);

const route = await import("../app/api/data/[resource]/route.ts");

async function resetStore() {
  await rm(path.join(tempDir, ".data"), { recursive: true, force: true });
}

function request(resource: string, url = `http://localhost/api/data/${resource}`) {
  return { params: Promise.resolve({ resource }), request: new NextRequest(url) };
}

test.after(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

test("GET /projects returns the default project when store is empty", async () => {
  await resetStore();
  const response = await route.GET(request("projects").request, request("projects"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.length, 1);
  assert.equal(body[0].title, "General");
});

test("GET /settings returns default settings when store is empty", async () => {
  await resetStore();
  const response = await route.GET(request("settings").request, request("settings"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.focusMinutes, 25);
  assert.equal(body.dailyWorkHours, 6);
  assert.equal(body.billingSchedule.weekdayHours.monday, 8);
  assert.equal(body.billingSchedule.weekdayHours.saturday, 0);
  assert.equal(body.billableRawToRoundedRate, 0.85);
  assert.equal(body.alertFocus75Enabled, true);
  assert.equal(body.alertRawFocusDoneEnabled, true);
  assert.equal(body.alertBillableNeedDoneEnabled, true);
  assert.equal(body.alertFinishBySlippingEnabled, true);
  assert.equal(body.alertIdleWhileWorkRemainsEnabled, false);
  assert.equal(body.alertBillableAheadBreakEnabled, true);
  assert.equal(body.rewardEnabled, true);
  assert.equal(body.rewardTargetRate, 0.7);
  assert.equal(body.rewardFocusMinutesPerFreeMinute, 3);
});

test("GET /settings normalizes old partial settings with alert defaults", async () => {
  await resetStore();
  await mkdir(path.join(tempDir, ".data"), { recursive: true });
  await writeFile(
    path.join(tempDir, ".data", "local-store.json"),
    JSON.stringify({
      auth: { owner: null, sessions: [] },
      data: {
        projects: [],
        tasks: [],
        todoItems: [],
        plans: [],
        sessions: [],
        settings: { focusMinutes: 45 },
        focusRewards: null,
      },
    }),
  );

  const response = await route.GET(request("settings").request, request("settings"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.focusMinutes, 45);
  assert.equal(body.alertFocus75Enabled, true);
  assert.equal(body.alertIdleWhileWorkRemainsEnabled, false);
  assert.equal(body.alertBillableAheadBreakEnabled, true);
});

test("GET /focus-rewards returns default ledger when store is empty", async () => {
  await resetStore();
  const response = await route.GET(request("focus-rewards").request, request("focus-rewards"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.bankMinutes, 0);
  assert.equal(body.earnedTodayMinutes, 0);
  assert.deepEqual(body.awardedSessions, {});
});

test("plans keep date in storage but omit it from responses", async () => {
  await resetStore();
  const payload = {
    id: "plan_1",
    title: "Write summary",
    linkedTaskId: null,
    priority: "must",
    status: "planned",
    order: 0,
  };

  await route.POST(
    new NextRequest("http://localhost/api/data/plans?date=2026-04-16", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ resource: "plans" }) },
  );

  const stored = JSON.parse(await readFile(path.join(tempDir, ".data", "local-store.json"), "utf8"));
  assert.equal(stored.data.plans[0].date, "2026-04-16");

  const response = await route.GET(new NextRequest("http://localhost/api/data/plans?date=2026-04-16"), {
    params: Promise.resolve({ resource: "plans" }),
  });
  const body = await response.json();
  assert.equal(body[0].date, undefined);
  assert.equal(body[0].title, "Write summary");
});

test("sessions respect start/end filtering", async () => {
  await resetStore();

  const createSession = async (id: string, startedAt: string) =>
    route.POST(
      new NextRequest("http://localhost/api/data/sessions", {
        method: "POST",
        body: JSON.stringify({
          id,
          mode: "focus",
          projectId: null,
          projectName: "General",
          taskId: null,
          taskName: "Task",
          startedAt,
          endedAt: startedAt,
          plannedDurationSec: 1500,
          actualDurationSec: 1500,
          completed: true,
          interrupted: false,
        }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ resource: "sessions" }) },
    );

  await createSession("session_a", "2026-04-16T09:00:00.000Z");
  await createSession("session_b", "2026-04-17T09:00:00.000Z");

  const response = await route.GET(
    new NextRequest("http://localhost/api/data/sessions?start=2026-04-17T00:00:00.000Z&end=2026-04-17T23:59:59.999Z"),
    { params: Promise.resolve({ resource: "sessions" }) },
  );
  const body = await response.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].id, "session_b");
});

test("todo items and sessions accept optional timer linkage fields", async () => {
  await resetStore();

  await route.POST(
    new NextRequest("http://localhost/api/data/todo-items", {
      method: "POST",
      body: JSON.stringify({
        id: "todo_1",
        project: "Client A",
        title: "Draft brief",
        hours: 1,
        urgency: 0.5,
        projectId: "project_a",
        completed: false,
        createdAt: "2026-04-16T08:00:00.000Z",
        updatedAt: "2026-04-16T08:00:00.000Z",
      }),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ resource: "todo-items" }) },
  );

  await route.POST(
    new NextRequest("http://localhost/api/data/sessions", {
      method: "POST",
      body: JSON.stringify({
        id: "session_todo",
        mode: "focus",
        projectId: null,
        projectName: null,
        taskId: null,
        todoItemId: "todo_1",
        taskName: "Draft brief",
        startedAt: "2026-04-16T09:00:00.000Z",
        endedAt: "2026-04-16T09:25:00.000Z",
        plannedDurationSec: 1500,
        actualDurationSec: 1500,
        completed: true,
        interrupted: false,
      }),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ resource: "sessions" }) },
  );

  const response = await route.GET(new NextRequest("http://localhost/api/data/sessions"), {
    params: Promise.resolve({ resource: "sessions" }),
  });
  const body = await response.json();

  assert.equal(body[0].todoItemId, "todo_1");

  const stored = JSON.parse(await readFile(path.join(tempDir, ".data", "local-store.json"), "utf8"));
  assert.equal(stored.data.todoItems[0].projectId, "project_a");
  assert.equal(stored.data.sessions[0].todoItemId, "todo_1");
});

test("posting a focus session updates reward ledger without double-awarding", async () => {
  await resetStore();
  const startedAt = new Date();
  startedAt.setHours(9, 0, 0, 0);
  const endedAt = new Date(startedAt.getTime() + 25 * 60 * 1000);
  const payload = {
    id: "session_reward",
    mode: "focus",
    projectId: null,
    projectName: null,
    taskId: null,
    todoItemId: null,
    taskName: "Rewarded work",
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    plannedDurationSec: 1500,
    actualDurationSec: 1500,
    completed: true,
    interrupted: false,
  };

  const postSession = () =>
    route.POST(
      new NextRequest("http://localhost/api/data/sessions", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ resource: "sessions" }) },
    );

  await postSession();
  await postSession();

  const response = await route.GET(new NextRequest("http://localhost/api/data/focus-rewards"), {
    params: Promise.resolve({ resource: "focus-rewards" }),
  });
  const body = await response.json();

  assert.equal(body.bankMinutes, 10);
  assert.equal(body.earnedTodayMinutes, 10);
  assert.equal(body.awardedSessions.session_reward.minutes, 10);
});

test("posting a non-focus or zero-duration session earns no rewards", async () => {
  await resetStore();

  const postSession = (id: string, mode: string, actualDurationSec: number) =>
    route.POST(
      new NextRequest("http://localhost/api/data/sessions", {
        method: "POST",
        body: JSON.stringify({
          id,
          mode,
          projectId: null,
          projectName: null,
          taskId: null,
          todoItemId: null,
          taskName: "No reward",
          startedAt: "2026-05-08T09:00:00.000Z",
          endedAt: "2026-05-08T09:25:00.000Z",
          plannedDurationSec: actualDurationSec,
          actualDurationSec,
          completed: true,
          interrupted: false,
        }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ resource: "sessions" }) },
    );

  await postSession("short_break", "shortBreak", 1500);
  await postSession("zero_focus", "focus", 0);

  const response = await route.GET(new NextRequest("http://localhost/api/data/focus-rewards"), {
    params: Promise.resolve({ resource: "focus-rewards" }),
  });
  const body = await response.json();

  assert.equal(body.bankMinutes, 0);
  assert.equal(body.earnedTodayMinutes, 0);
  assert.deepEqual(body.awardedSessions, {});
});
