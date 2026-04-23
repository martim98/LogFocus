import test from "node:test";
import assert from "node:assert/strict";
import {
  getBillingCalendarSummary,
  getBillableDaySummary,
  getWorkweekBillableProgressToNow,
  getBillableWeekPaceToTarget,
  getBillableWeekSummary,
  getDailyProductivity,
  getProjectStats,
  getSuggestedFocusTime,
  getTodayStats,
  getWorkweekBillableSummary,
  getWorkweekLoggedHours,
} from "../lib/analytics.ts";
import { endOfDayIso, getDateKey, startOfDayIso } from "../lib/utils.ts";
import { createDefaultBillingSchedule } from "../lib/domain.ts";
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

const weekendCarrySessions: FocusSession[] = [
  {
    id: "weekend_sat",
    mode: "focus",
    projectId: "project_a",
    projectName: "Client A",
    taskId: "task_a",
    taskName: "Feature work",
    startedAt: "2026-04-18T10:00:00.000Z",
    endedAt: "2026-04-18T14:00:00.000Z",
    plannedDurationSec: 14400,
    actualDurationSec: 14400,
    completed: true,
    interrupted: false,
  },
  {
    id: "weekend_sun",
    mode: "focus",
    projectId: "project_a",
    projectName: "Client A",
    taskId: "task_a",
    taskName: "Feature work",
    startedAt: "2026-04-19T10:00:00.000Z",
    endedAt: "2026-04-19T14:00:00.000Z",
    plannedDurationSec: 14400,
    actualDurationSec: 14400,
    completed: true,
    interrupted: false,
  },
  {
    id: "weekend_mon",
    mode: "focus",
    projectId: "project_a",
    projectName: "Client A",
    taskId: "task_a",
    taskName: "Feature work",
    startedAt: "2026-04-20T09:00:00.000Z",
    endedAt: "2026-04-20T11:00:00.000Z",
    plannedDurationSec: 7200,
    actualDurationSec: 7200,
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

test("workweek hours carry weekend time into the next Monday-start week", () => {
  const loggedHours = getWorkweekLoggedHours(weekendCarrySessions, "2026-04-21");
  assert.equal(loggedHours, 10);

  const weekSummary = getWorkweekBillableSummary(weekendCarrySessions, "2026-04-21", 6, 5);
  assert.equal(weekSummary.billableHours, 10);
  assert.equal(weekSummary.targetHoursThroughToday, 12);
  assert.equal(weekSummary.isOnTarget, false);
});

test("week pacing lowers today's needed hours when weekend time carries into the week", () => {
  const loggedHours = getWorkweekLoggedHours(weekendCarrySessions, "2026-04-21");
  const weeklyTargetHours = 6 * 5;
  const remainingWorkdays = 4;
  const hoursNeededToday = Math.max(0, weeklyTargetHours - loggedHours) / remainingWorkdays;

  assert.equal(Number(hoursNeededToday.toFixed(1)), 5.0);
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
  assert.equal(Number(progress.expectedBillableHoursPerHour.toFixed(3)), 0.607);
  assert.equal(Number(progress.deltaHours.toFixed(2)), -29.46);
});

test("billing calendar carries weekend billable time into the current week", () => {
  const calendar = getBillingCalendarSummary(weekendCarrySessions, "2026-04-20", createDefaultBillingSchedule(), 0.85);
  const monday = calendar.rows.find((row) => row.dateKey === "2026-04-20");

  assert.equal(calendar.carryInBillableHours, 8);
  assert.equal(calendar.carryInRawHours, 8);
  assert.equal(monday?.openingBillableHours, 8);
  assert.equal(monday?.billableHours, 2);
  assert.equal(monday?.cumulativePlannedHours, 8);
  assert.equal(Number(monday?.cumulativeBillableHours.toFixed(1)), 10.0);
  assert.equal(Number(monday?.billablePercent?.toFixed(1) ?? 0), 125.0);
  assert.equal(Number(calendar.totalBillableHours.toFixed(1)), 10.0);
  assert.equal(Number(calendar.totalPlannedHours.toFixed(1)), 40.0);
  assert.equal(Number(calendar.currentPlannedHours.toFixed(1)), 8.0);
  assert.equal(Number(calendar.totalTargetBillableHours.toFixed(1)), 6.8);
  assert.equal(Number(calendar.remainingToTargetHours.toFixed(1)), 0.0);
  assert.equal(Number(calendar.tomorrowStartBillableHours?.toFixed(1) ?? 0), 10.0);
});

test("billing calendar respects date overrides and zero-hour days", () => {
  const schedule = createDefaultBillingSchedule();
  schedule.weekdayHours.wednesday = 0;
  schedule.dateOverrides["2026-04-21"] = 0;

  const calendar = getBillingCalendarSummary(sessions, "2026-04-21", schedule, 0.85);
  const tuesday = calendar.rows.find((row) => row.dateKey === "2026-04-21");
  const wednesday = calendar.rows.find((row) => row.dateKey === "2026-04-22");

  assert.equal(tuesday?.plannedHours, 0);
  assert.equal(tuesday?.targetBillableHours, 0);
  assert.equal(wednesday?.plannedHours, 0);
  assert.equal(wednesday?.targetBillableHours, 0);
});

test("billing calendar omits tomorrow preview on the final scheduled day", () => {
  const calendar = getBillingCalendarSummary(sessions, "2026-04-24", createDefaultBillingSchedule(), 0.85);

  assert.equal(calendar.finalScheduledDateKey, "2026-04-24");
  assert.equal(calendar.tomorrowStartBillableHours, null);
});

test("suggested focus time remains in the supported set", () => {
  const suggestion = getSuggestedFocusTime(sessions, "2026-04-16", 6);
  assert.ok([25, 35, 50].includes(suggestion.minutes));
  assert.ok(suggestion.reason.length > 0);
});

test("getDateKey applies the 3AM day cutoff", () => {
  const originalToISOString = Date.prototype.toISOString;
  let toISOStringCalled = false;

  Date.prototype.toISOString = function (...args: never[]) {
    toISOStringCalled = true;
    return originalToISOString.apply(this, args as never);
  };

  try {
    const beforeCutoff = new Date(2026, 3, 20, 2, 59, 59, 999);
    const atCutoff = new Date(2026, 3, 20, 3, 0, 0, 0);

    assert.equal(getDateKey(beforeCutoff), "2026-04-19");
    assert.equal(getDateKey(atCutoff), "2026-04-20");
    assert.equal(toISOStringCalled, false);
  } finally {
    Date.prototype.toISOString = originalToISOString;
  }
});

test("day range helpers use the same 3AM boundary", () => {
  const start = new Date(startOfDayIso("2026-04-20"));
  const end = new Date(endOfDayIso("2026-04-20"));

  assert.equal(start.getHours(), 3);
  assert.equal(start.getMinutes(), 0);
  assert.equal(start.getSeconds(), 0);

  assert.equal(end.getDate(), 21);
  assert.equal(end.getHours(), 2);
  assert.equal(end.getMinutes(), 59);
  assert.equal(end.getSeconds(), 59);
});
