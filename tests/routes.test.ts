import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
