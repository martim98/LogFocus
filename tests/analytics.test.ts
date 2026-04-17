import test from "node:test";
import assert from "node:assert/strict";
import {
  getBillableDaySummary,
  getWorkweekBillableProgressToNow,
  getBillableWeekPaceToTarget,
  getBillableWeekSummary,
  getDailyProductivity,
  getProjectStats,
  getSuggestedFocusTime,
  getTodayStats,
} from "../lib/analytics.ts";
import type { FocusSession, PlanItem, Task } from "../lib/domain.ts";

const tasks: Task[] = [
  {
    id: "task_a",
    project: "Client A",
    title: "Feature work",
    hours: 2,
    urgency: 0,
    status: "todo",
    projectId: "project_a",
    order: 0,
    createdAt: "2026-04-14T08:00:00.000Z",
    updatedAt: "2026-04-14T08:00:00.000Z",
  },
  {
    id: "task_b",
    project: "Admin",
    title: "General admin",
    hours: 1,
    urgency: 1,
    status: "done",
    projectId: "project_admin",
    order: 1,
    createdAt: "2026-04-14T08:00:00.000Z",
    updatedAt: "2026-04-14T08:00:00.000Z",
  },
];

const planItems: PlanItem[] = [
  { id: "plan_1", title: "Feature work", linkedTaskId: "task_a", priority: "must", status: "done", order: 0 },
  { id: "plan_2", title: "Inbox", linkedTaskId: null, priority: "should", status: "planned", order: 1 },
];

const sessions: FocusSession[] = [
  {
    id: "session_1",
    mode: "focus",
    projectId: "project_a",
    projectName: "Client A",
    taskId: "task_a",
    taskName: "Feature work",
    startedAt: "2026-04-16T09:00:00.000Z",
    endedAt: "2026-04-16T10:00:00.000Z",
    plannedDurationSec: 3600,
    actualDurationSec: 3600,
    completed: true,
    interrupted: false,
  },
  {
    id: "session_2",
    mode: "focus",
    projectId: "project_admin",
    projectName: "Admin",
    taskId: "task_b",
    taskName: "General admin",
    startedAt: "2026-04-16T10:15:00.000Z",
    endedAt: "2026-04-16T10:45:00.000Z",
    plannedDurationSec: 1800,
    actualDurationSec: 1800,
    completed: true,
    interrupted: false,
  },
  {
    id: "session_3",
    mode: "focus",
    projectId: null,
    projectName: "Training",
    taskId: null,
    taskName: "Course",
    startedAt: "2026-04-15T09:00:00.000Z",
    endedAt: "2026-04-15T10:00:00.000Z",
    plannedDurationSec: 3600,
    actualDurationSec: 3600,
    completed: true,
    interrupted: false,
  },
];

test("getTodayStats preserves counts and remaining hours semantics", () => {
  const stats = getTodayStats(sessions, tasks, planItems, "2026-04-16");
  assert.equal(stats.focusMinutes, 90);
  assert.equal(stats.loggedSessions, 2);
  assert.equal(stats.completedSessions, 2);
  assert.equal(stats.tasksDone, 1);
  assert.equal(stats.donePlan, 1);
  assert.equal(stats.remainingPomodoros, 2);
});

test("getProjectStats resolves tasks and sessions by project linkage", () => {
  const stats = getProjectStats("project_a", "Client A", sessions, tasks);
  assert.equal(stats.focusMinutes, 60);
  assert.equal(stats.loggedSessions, 1);
  assert.equal(stats.tasksDone, 0);
  assert.equal(stats.remainingPomodoros, 2);
});

test("getDailyProductivity keeps elapsed and inefficiency calculations", () => {
  const stats = getDailyProductivity(sessions, "2026-04-15");
  assert.ok(stats);
  assert.equal(stats?.workTimeSec, 3600);
  assert.equal(stats?.totalElapsedSec, 3600);
  assert.equal(stats?.inefficiencySec, 0);
  assert.equal(Math.round(stats?.productivityScore ?? 0), 100);
});

test("billable summaries preserve exclusion and rounding rules", () => {
  const daySummary = getBillableDaySummary(sessions, "2026-04-16", 8, 0.85);
  assert.equal(daySummary.entries.length, 2);
  assert.equal(daySummary.billableHours, 1.5);
  assert.equal(daySummary.totalRawHours, 1.5);

  const weekSummary = getBillableWeekSummary(sessions, "2026-04-16", 40);
  assert.equal(weekSummary.billableHours, 1.5);
  assert.equal(weekSummary.totalRawHours, 1.5);
});

test("week pace to target keeps remaining-hours math", () => {
  const pace = getBillableWeekPaceToTarget(sessions, "2026-04-16", 40, 0.85);
  assert.equal(pace.billableHoursBeforeToday, 0);
  assert.equal(pace.remainingBillableHours, 34);
  assert.equal(pace.daysRemainingIncludingToday, 2);
  assert.equal(pace.hoursPerDayNeeded, 17);
});

test("workweek billable progress to now uses the configured cutoff and first session start", () => {
  const progress = getWorkweekBillableProgressToNow(
    sessions,
    "2026-04-17",
    8,
    0.85,
    5,
    5,
    "18:00",
    new Date("2026-04-17T12:00:00.000Z"),
  );
  assert.equal(progress.startDateKey, "2026-04-15");
  assert.equal(progress.actualBillableHours, 1.5);
  assert.equal(Number(progress.expectedBillableHours.toFixed(2)), 30.96);
  assert.equal(Number(progress.deltaHours.toFixed(2)), -29.46);
});

test("suggested focus time remains in the supported set", () => {
  const suggestion = getSuggestedFocusTime(sessions, "2026-04-16", 6);
  assert.ok([25, 35, 50].includes(suggestion.minutes));
  assert.ok(suggestion.reason.length > 0);
});
