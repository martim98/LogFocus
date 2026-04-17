import test from "node:test";
import assert from "node:assert/strict";
import { buildGroupedBillableReportCsv, buildPomofocusReportCsv } from "../lib/report-export.ts";
import type { FocusSession, Project, Task } from "../lib/domain.ts";

const projects: Project[] = [
  { id: "project_a", title: "ALPHA", order: 0, createdAt: "2026-04-10T08:00:00.000Z", updatedAt: "2026-04-10T08:00:00.000Z" },
  { id: "project_b", title: "BETA", order: 1, createdAt: "2026-04-10T08:00:00.000Z", updatedAt: "2026-04-10T08:00:00.000Z" },
  { id: "project_training", title: "TRAINING", order: 2, createdAt: "2026-04-10T08:00:00.000Z", updatedAt: "2026-04-10T08:00:00.000Z" },
];

const tasks: Task[] = [
  {
    id: "task_x",
    project: "ALPHA",
    title: "review",
    hours: 1,
    urgency: 0,
    status: "todo",
    projectId: "project_a",
    order: 0,
    createdAt: "2026-04-10T08:00:00.000Z",
    updatedAt: "2026-04-10T08:00:00.000Z",
  },
  {
    id: "task_y",
    project: "ALPHA",
    title: "draft",
    hours: 1,
    urgency: 0,
    status: "todo",
    projectId: "project_a",
    order: 1,
    createdAt: "2026-04-10T08:00:00.000Z",
    updatedAt: "2026-04-10T08:00:00.000Z",
  },
  {
    id: "task_z",
    project: "BETA",
    title: "analysis",
    hours: 1,
    urgency: 0,
    status: "todo",
    projectId: "project_b",
    order: 2,
    createdAt: "2026-04-10T08:00:00.000Z",
    updatedAt: "2026-04-10T08:00:00.000Z",
  },
  {
    id: "task_training",
    project: "TRAINING",
    title: "lesson",
    hours: 1,
    urgency: 0,
    status: "todo",
    projectId: "project_training",
    order: 3,
    createdAt: "2026-04-10T08:00:00.000Z",
    updatedAt: "2026-04-10T08:00:00.000Z",
  },
];

const sessions: FocusSession[] = [
  {
    id: "s1",
    mode: "focus",
    projectId: "project_a",
    projectName: "ALPHA",
    taskId: "task_x",
    taskName: "review",
    startedAt: "2026-04-13T09:00:00.000Z",
    endedAt: "2026-04-13T09:20:00.000Z",
    plannedDurationSec: 1200,
    actualDurationSec: 1200,
    completed: true,
    interrupted: false,
  },
  {
    id: "s2",
    mode: "focus",
    projectId: "project_a",
    projectName: "ALPHA",
    taskId: "task_x",
    taskName: "review",
    startedAt: "2026-04-13T10:00:00.000Z",
    endedAt: "2026-04-13T10:15:00.000Z",
    plannedDurationSec: 900,
    actualDurationSec: 900,
    completed: true,
    interrupted: false,
  },
  {
    id: "s3",
    mode: "focus",
    projectId: "project_a",
    projectName: "ALPHA",
    taskId: "task_y",
    taskName: "draft",
    startedAt: "2026-04-13T11:00:00.000Z",
    endedAt: "2026-04-13T11:30:00.000Z",
    plannedDurationSec: 1800,
    actualDurationSec: 1800,
    completed: true,
    interrupted: false,
  },
  {
    id: "s4",
    mode: "focus",
    projectId: "project_b",
    projectName: "BETA",
    taskId: "task_z",
    taskName: "analysis",
    startedAt: "2026-04-14T09:00:00.000Z",
    endedAt: "2026-04-14T09:35:00.000Z",
    plannedDurationSec: 2100,
    actualDurationSec: 2100,
    completed: true,
    interrupted: false,
  },
  {
    id: "s5",
    mode: "focus",
    projectId: "project_training",
    projectName: "TRAINING",
    taskId: "task_training",
    taskName: "lesson",
    startedAt: "2026-04-14T10:00:00.000Z",
    endedAt: "2026-04-14T10:30:00.000Z",
    plannedDurationSec: 1800,
    actualDurationSec: 1800,
    completed: true,
    interrupted: false,
  },
];

test("grouped billable export merges day/project/task rows and rounds bucket time", () => {
  const csv = buildGroupedBillableReportCsv(sessions, projects, tasks, {
    startDate: "2026-04-13",
    endDate: "2026-04-14",
    delimiter: "comma",
  });

  const lines = csv.replace(/^\uFEFF/, "").trim().split("\n");
  assert.deepEqual(lines, [
    "date,project,task,hours,startTime,endTime",
    "20260413,ALPHA,draft,0.5,12:00,12:30",
    "20260413,ALPHA,review,0.75,10:00,11:15",
    "20260414,BETA,analysis,0.75,10:00,10:35",
    "20260414,TRAINING,lesson,0.5,11:00,11:30",
  ]);
});

test("raw export still preserves the legacy one-row-per-session structure", () => {
  const csv = buildPomofocusReportCsv(sessions, projects, tasks, {
    startDate: "2026-04-13",
    endDate: "2026-04-14",
    includeTask: true,
    delimiter: "comma",
    timeFormat: "hours",
  });

  const lines = csv.replace(/^\uFEFF/, "").trim().split("\n");
  assert.equal(lines.length, 6);
  assert.equal(lines[1], "20260413,ALPHA,review,0.33,10:00,10:20");
  assert.equal(lines[2], "20260413,ALPHA,review,0.25,11:00,11:15");
});
