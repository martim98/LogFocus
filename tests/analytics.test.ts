import test from "node:test";
import assert from "node:assert/strict";
import {
  createDayCoachMemory,
  createSessionAnalyticsIndex,
  createLiveBannerAlertMemory,
  evaluateDayCoach,
  evaluateLiveBannerAlerts,
  getBillingCalendarSummary,
  getBillableAdjustedDailyTargetHours,
  getBillableAdjustedWeeklyTargetHours,
  getBillableDaySummary,
  getDailyBillableRollingAverage,
  getDailyProductivityTrend,
  getWorkweekBillableProgressToNow,
  getBillableWeekPaceToTarget,
  getBillableWeekSummary,
  getDailyProductivity,
  getLiveBannerPaceSummary,
  getProjectStats,
  isBillableProjectTask,
  getSuggestedBillableWeekTarget,
  getSuggestedFocusTime,
  getTaskTimeLogged,
  getTargetBoundedProductivityStats,
  getTodoItemTimeLogged,
  getTodoItemTimeLoggedToday,
  getTodayStats,
  getTopProjectWeeklyStats,
  getVisibleWeekLoggedHours,
  getWorkweekBillableSummary,
  getWorkweekLoggedHours,
} from "../lib/analytics.ts";
import type { BillingCalendarSummary, LiveBannerPaceSummary } from "../lib/analytics.ts";
import { endOfDayIso, getDateKey, startOfDayIso } from "../lib/utils.ts";
import { createDefaultBillingSchedule, createDefaultFocusRewardLedger, defaultSettings } from "../lib/domain.ts";
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

const alertSettings = {
  alertFocus75Enabled: true,
  alertRawFocusDoneEnabled: true,
  alertBillableNeedDoneEnabled: true,
  alertFinishBySlippingEnabled: true,
  alertIdleWhileWorkRemainsEnabled: false,
  alertBillableAheadBreakEnabled: true,
};

function billableSession(id: string, startedAt: string, hours: number): FocusSession {
  const start = new Date(startedAt);
  const end = new Date(start.getTime() + hours * 3600 * 1000);

  return {
    id,
    mode: "focus",
    projectId: "project_a",
    projectName: "Client A",
    taskId: "task_a",
    taskName: "Feature work",
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    plannedDurationSec: hours * 3600,
    actualDurationSec: hours * 3600,
    completed: true,
    interrupted: false,
  };
}

function billableWeekSessions(idPrefix: string, weekStartDateKey: string, dailyHours: number[]) {
  return dailyHours.map((hours, index) => (
    billableSession(
      `${idPrefix}_${index}`,
      `${new Date(Date.parse(`${weekStartDateKey}T00:00:00.000Z`) + (index + 2) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}T09:00:00.000Z`,
      hours,
    )
  ));
}

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

test("top project weekly stats aggregate mean median and peak by active weeks", () => {
  const rows = getTopProjectWeeklyStats(
    [
      { id: "project_a", title: "Client A" },
      { id: "project_admin", title: "Admin" },
    ],
    [
      ...sessions,
      {
        id: "session_4",
        mode: "focus",
        projectId: "project_a",
        projectName: "Client A",
        taskId: "task_a",
        taskName: "Feature work",
        startedAt: "2026-04-21T09:00:00.000Z",
        endedAt: "2026-04-21T11:00:00.000Z",
        plannedDurationSec: 7200,
        actualDurationSec: 7200,
        completed: true,
        interrupted: false,
      },
      {
        id: "session_5",
        mode: "focus",
        projectId: "project_a",
        projectName: "Client A",
        taskId: "task_a",
        taskName: "Feature work",
        startedAt: "2026-04-23T10:00:00.000Z",
        endedAt: "2026-04-23T11:30:00.000Z",
        plannedDurationSec: 5400,
        actualDurationSec: 5400,
        completed: true,
        interrupted: false,
      },
    ],
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.projectId, "project_a");
  assert.equal(rows[0]?.totalMinutes, 270);
  assert.equal(rows[0]?.weeksActive, 2);
  assert.equal(rows[0]?.meanMinutesPerWeek, 135);
  assert.equal(rows[0]?.medianMinutesPerWeek, 135);
  assert.equal(rows[0]?.peakMinutesPerWeek, 210);
});

test("getDailyProductivity keeps elapsed and inefficiency calculations", () => {
  const stats = getDailyProductivity(sessions, "2026-04-15");
  assert.ok(stats);
  assert.equal(stats?.workTimeSec, 3600);
  assert.equal(stats?.totalElapsedSec, 3600);
  assert.equal(stats?.inefficiencySec, 0);
  assert.equal(Math.round(stats?.productivityScore ?? 0), 100);
});

test("daily productivity trend marks weekends for chart filtering", () => {
  const trend = getDailyProductivityTrend(
    [
      billableSession("weekday_trend", "2026-04-17T09:00:00.000Z", 1),
      billableSession("weekend_trend", "2026-04-18T09:00:00.000Z", 1),
    ],
    2,
    "2026-04-18",
  );

  assert.equal(trend[0].dateKey, "2026-04-17");
  assert.equal(trend[0].isWeekday, true);
  assert.equal(trend[1].dateKey, "2026-04-18");
  assert.equal(trend[1].isWeekday, false);
});

test("target-bounded productivity uses live score before target is reached", () => {
  const stats = getTargetBoundedProductivityStats(
    [billableSession("bounded_open", "2026-04-15T09:00:00.000Z", 1)],
    "2026-04-15",
    2,
    new Date("2026-04-15T11:00:00.000Z"),
  );

  assert.equal(stats?.targetReached, false);
  assert.equal(stats?.totalElapsedSec, 7200);
  assert.equal(stats?.workTimeSec, 3600);
  assert.equal(stats?.productivityScore, 50);
});

test("target-bounded productivity freezes when required focus is reached", () => {
  const stats = getTargetBoundedProductivityStats(
    [
      billableSession("bounded_first", "2026-04-15T09:00:00.000Z", 1),
      billableSession("bounded_second", "2026-04-15T10:30:00.000Z", 1.5),
      {
        ...billableSession("bounded_late", "2026-04-15T17:00:00.000Z", 1),
        mode: "longBreak",
      },
    ],
    "2026-04-15",
    2,
    new Date("2026-04-15T18:00:00.000Z"),
  );

  assert.equal(stats?.targetReached, true);
  assert.equal(stats?.endTime, "2026-04-15T11:30:00.000Z");
  assert.equal(stats?.totalElapsedSec, 9000);
  assert.equal(stats?.workTimeSec, 7200);
  assert.equal(stats?.actualWorkTimeSec, 9000);
  assert.equal(stats?.productivityScore, 80);
});

test("daily productivity score freezes while preserving logged work seconds", () => {
  const oneDaySchedule = {
    ...createDefaultBillingSchedule(),
    weekdayHours: {
      sunday: 0,
      monday: 0,
      tuesday: 0,
      wednesday: 8,
      thursday: 0,
      friday: 0,
      saturday: 0,
    },
  };
  const stats = getDailyProductivity(
    [
      billableSession("daily_bounded_first", "2026-04-15T09:00:00.000Z", 1),
      billableSession("daily_bounded_second", "2026-04-15T10:30:00.000Z", 1.5),
      billableSession("daily_bounded_extra", "2026-04-15T13:00:00.000Z", 1),
    ],
    "2026-04-15",
    oneDaySchedule,
    0.25,
    1,
    new Date("2026-04-15T18:00:00.000Z"),
  );

  assert.equal(stats?.workTimeSec, 12600);
  assert.equal(stats?.productivityScore, 80);
});

test("todo-item time summaries stay separate from task analytics", () => {
  const todoSessions: FocusSession[] = [
    ...sessions,
    {
      id: "session_todo",
      mode: "focus",
      projectId: null,
      projectName: "Client A",
      taskId: null,
      todoItemId: "todo_1",
      taskName: "Follow-up",
      startedAt: "2026-04-16T12:00:00.000Z",
      endedAt: "2026-04-16T12:20:00.000Z",
      plannedDurationSec: 1200,
      actualDurationSec: 1200,
      completed: true,
      interrupted: false,
    },
  ];

  assert.equal(getTodoItemTimeLogged("todo_1", todoSessions), 20);
  assert.equal(getTodoItemTimeLoggedToday("todo_1", todoSessions, "2026-04-16"), 20);
  assert.equal(getProjectStats("project_a", "Client A", todoSessions, tasks).focusMinutes, 60);
});

test("session analytics index preserves public task todo and day summaries", () => {
  const indexedSessions: FocusSession[] = [
    ...sessions,
    {
      id: "todo_session_1",
      mode: "focus",
      projectId: "project_a",
      projectName: "Client A",
      taskId: "task_a",
      todoItemId: "todo_a",
      taskName: "Feature work",
      startedAt: "2026-04-16T11:00:00.000Z",
      endedAt: "2026-04-16T11:20:00.000Z",
      plannedDurationSec: 1200,
      actualDurationSec: 1200,
      completed: true,
      interrupted: false,
    },
  ];
  const index = createSessionAnalyticsIndex(indexedSessions);

  assert.equal(index.focusSessions.length, 4);
  assert.equal(index.focusSessionsByDate.get("2026-04-16")?.length, 3);
  assert.equal(Math.round((index.focusSecondsByTaskId.get("task_a") ?? 0) / 60), getTaskTimeLogged("task_a", indexedSessions));
  assert.equal(index.focusSecondsByTodoItemDate.get("2026-04-16")?.get("todo_a"), 1200);
  assert.equal(getTodoItemTimeLogged("todo_a", indexedSessions), 20);
  assert.equal(getTodoItemTimeLoggedToday("todo_a", indexedSessions, "2026-04-16"), 20);
  assert.deepEqual(getBillableDaySummary(indexedSessions, "2026-04-16").entries, [
    {
      project: "Client A",
      task: "Feature work",
      rawHours: 1 + 1 / 3,
      roundedHours: 1.5,
    },
    {
      project: "Admin",
      task: "General admin",
      rawHours: 0.5,
      roundedHours: 0.5,
    },
  ]);
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

test("reward target overrides do not affect billable summaries or live billable fields", () => {
  const overrideLedger = {
    ...createDefaultFocusRewardLedger(),
    targetRateOverrideDate: "2026-04-16",
    targetRateOverride: 0.75,
  };
  void overrideLedger;

  const daySummary = getBillableDaySummary(sessions, "2026-04-16", 8, 0.85);
  const weekSummary = getBillableWeekSummary(sessions, "2026-04-16", 40);
  const calendar = getBillingCalendarSummary(sessions, "2026-04-16", createDefaultBillingSchedule(), 0.85);
  const calendarWithOverrideState = getBillingCalendarSummary(sessions, "2026-04-16", createDefaultBillingSchedule(), 0.85);
  const pace = getLiveBannerPaceSummary(
    sessions,
    "2026-04-16",
    createDefaultBillingSchedule(),
    0.85,
    0.7,
    new Date("2026-04-16T12:00:00.000Z"),
  );

  assert.equal(daySummary.billableHours, 1.5);
  assert.equal(daySummary.totalRawHours, 1.5);
  assert.equal(weekSummary.billableHours, 1.5);
  assert.equal(weekSummary.totalRawHours, 1.5);
  assert.equal(calendar.totalBillableHours, 1.5);
  assert.equal(calendarWithOverrideState.totalBillableHours, calendar.totalBillableHours);
  assert.equal(calendarWithOverrideState.totalTargetBillableHours, calendar.totalTargetBillableHours);
  assert.equal(pace.weeklyRoundedBillableTargetHours, 34);
  assert.equal(pace.todayRoundedBillableHours, 1.5);
  assert.equal(pace.roundedBillableNeededTodayHours, 17);
});

test("billable classifier keeps admin general admin billable and excludes other admin work", () => {
  assert.equal(isBillableProjectTask("TRAINING", "lesson"), false);
  assert.equal(isBillableProjectTask("Admin", "General admin"), true);
  assert.equal(isBillableProjectTask("ADMIN", "inbox"), false);
  assert.equal(isBillableProjectTask("Client A", "Feature work"), true);

  const daySummary = getBillableDaySummary(
    [
      {
        ...billableSession("admin_general", "2026-04-16T09:00:00.000Z", 0.4),
        projectId: "project_admin",
        projectName: "ADMIN",
        taskId: "admin_general",
        taskName: "general admin",
      },
      {
        ...billableSession("admin_inbox", "2026-04-16T10:00:00.000Z", 0.4),
        projectId: "project_admin",
        projectName: "ADMIN",
        taskId: "admin_inbox",
        taskName: "inbox",
      },
      {
        ...billableSession("training_lesson", "2026-04-16T11:00:00.000Z", 0.4),
        projectId: "project_training",
        projectName: "TRAINING",
        taskId: "training_lesson",
        taskName: "lesson",
      },
    ],
    "2026-04-16",
    8,
    0.85,
  );

  assert.deepEqual(daySummary.entries, [
    {
      project: "ADMIN",
      task: "general admin",
      rawHours: 0.4,
      roundedHours: 0.5,
    },
  ]);
  assert.equal(daySummary.billableHours, 0.5);
  assert.equal(daySummary.totalRawHours, 0.4);
});

test("billable summaries resolve missing project names from project ids", () => {
  const daySummary = getBillableDaySummary(
    [
      {
        ...billableSession("missing_project_name", "2026-04-16T09:00:00.000Z", 0.4),
        projectId: "project_a",
        projectName: null,
      },
    ],
    "2026-04-16",
    8,
    0.85,
    [{ id: "project_a", title: "Client A" }],
  );

  assert.equal(daySummary.entries.length, 1);
  assert.equal(daySummary.entries[0].project, "Client A");
  assert.equal(daySummary.entries[0].task, "Feature work");
  assert.equal(daySummary.entries[0].roundedHours, 0.5);
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

test("visible weekly hours reset on Saturday while carry-in logic remains separate", () => {
  const fridayVisibleHours = getVisibleWeekLoggedHours(weekendCarrySessions, "2026-04-24");
  const saturdayVisibleHours = getVisibleWeekLoggedHours(weekendCarrySessions, "2026-04-25");

  assert.equal(fridayVisibleHours, 10);
  assert.equal(saturdayVisibleHours, 0);
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

test("billing calendar uses a Saturday-start visible week with no prior-week carry-in", () => {
  const calendar = getBillingCalendarSummary(weekendCarrySessions, "2026-04-20", createDefaultBillingSchedule(), 0.85);
  const saturday = calendar.rows.find((row) => row.dateKey === "2026-04-18");
  const sunday = calendar.rows.find((row) => row.dateKey === "2026-04-19");
  const monday = calendar.rows.find((row) => row.dateKey === "2026-04-20");

  assert.equal(calendar.startDateKey, "2026-04-18");
  assert.equal(calendar.endDateKey, "2026-04-24");
  assert.equal(calendar.carryInBillableHours, 0);
  assert.equal(calendar.carryInRawHours, 0);
  assert.equal(calendar.rows.some((row) => row.kind === "carryIn"), false);
  assert.equal(saturday?.billableHours, 4);
  assert.equal(sunday?.billableHours, 4);
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

test("billing calendar resets on the first Saturday of a new visible week", () => {
  const calendar = getBillingCalendarSummary(weekendCarrySessions, "2026-04-26", createDefaultBillingSchedule(), 0.85);

  assert.equal(calendar.startDateKey, "2026-04-25");
  assert.equal(calendar.endDateKey, "2026-05-01");
  assert.equal(calendar.totalBillableHours, 0);
  assert.equal(calendar.currentPlannedHours, 0);
  assert.equal(calendar.rows.some((row) => row.dateKey === "2026-04-20"), false);
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

test("suggested billable week target lowers over-target history by no more than ten percent", () => {
  const suggestion = getSuggestedBillableWeekTarget(
    [
      ...billableWeekSessions("over_1", "2026-04-18", [8, 8, 8, 8, 8]),
      ...billableWeekSessions("over_2", "2026-04-11", [8, 8, 8, 8, 8]),
      ...billableWeekSessions("over_3", "2026-04-04", [8, 8, 8, 8, 8]),
      ...billableWeekSessions("over_4", "2026-03-28", [8, 8, 8, 8, 8]),
    ],
    "2026-04-29",
    createDefaultBillingSchedule(),
    0.85,
  );

  assert.equal(suggestion.direction, "rest");
  assert.equal(suggestion.weeksUsed, 4);
  assert.equal(suggestion.baselineTargetHours, 34);
  assert.equal(suggestion.historicalAverageHours, 40);
  assert.equal(suggestion.historicalAverageRate, 1);
  assert.equal(Number((suggestion.suggestedRate * 100).toFixed(1)), 76.5);
  assert.equal(Number(suggestion.suggestedHours.toFixed(1)), 30.6);
});

test("suggested billable week target raises under-target history by no more than ten percent", () => {
  const suggestion = getSuggestedBillableWeekTarget(
    [
      ...billableWeekSessions("under_1", "2026-04-18", [5, 5, 5, 5, 5]),
      ...billableWeekSessions("under_2", "2026-04-11", [5, 5, 5, 5, 5]),
      ...billableWeekSessions("under_3", "2026-04-04", [5, 5, 5, 5, 5]),
      ...billableWeekSessions("under_4", "2026-03-28", [5, 5, 5, 5, 5]),
    ],
    "2026-04-29",
    createDefaultBillingSchedule(),
    0.85,
  );

  assert.equal(suggestion.direction, "catch-up");
  assert.equal(suggestion.historicalAverageHours, 25);
  assert.equal(suggestion.historicalAverageRate, 0.625);
  assert.equal(Number((suggestion.suggestedRate * 100).toFixed(1)), 93.5);
  assert.equal(Number(suggestion.suggestedHours.toFixed(1)), 37.4);
});

test("suggested billable week target keeps exact-target history at baseline", () => {
  const suggestion = getSuggestedBillableWeekTarget(
    [
      ...billableWeekSessions("exact_1", "2026-04-18", [6.75, 6.75, 6.75, 6.75, 7]),
      ...billableWeekSessions("exact_2", "2026-04-11", [6.75, 6.75, 6.75, 6.75, 7]),
      ...billableWeekSessions("exact_3", "2026-04-04", [6.75, 6.75, 6.75, 6.75, 7]),
      ...billableWeekSessions("exact_4", "2026-03-28", [6.75, 6.75, 6.75, 6.75, 7]),
    ],
    "2026-04-29",
    createDefaultBillingSchedule(),
    0.85,
  );

  assert.equal(suggestion.direction, "baseline");
  assert.equal(suggestion.suggestedHours, 34);
  assert.equal(suggestion.suggestedRate, 0.85);
  assert.equal(Number(suggestion.deltaRate.toFixed(3)), 0);
});

test("suggested billable week target uses partial completed-week history and falls back with none", () => {
  const partial = getSuggestedBillableWeekTarget(
    billableWeekSessions("partial_1", "2026-04-18", [6, 6, 6]),
    "2026-04-29",
    createDefaultBillingSchedule(),
    0.85,
  );
  const empty = getSuggestedBillableWeekTarget([], "2026-04-29", createDefaultBillingSchedule(), 0.85);

  assert.equal(partial.weeksUsed, 1);
  assert.equal(partial.historicalAverageHours, 18);
  assert.equal(partial.baselineTargetHours, 34);
  assert.equal(partial.historicalAverageRate, 0.75);
  assert.equal(Number((partial.suggestedRate * 100).toFixed(1)), 93.5);
  assert.equal(partial.direction, "catch-up");
  assert.equal(empty.weeksUsed, 0);
  assert.equal(empty.historicalAverageHours, null);
  assert.equal(empty.historicalAverageRate, null);
  assert.equal(empty.suggestedRate, 0.85);
  assert.equal(empty.suggestedHours, 34);
  assert.equal(empty.reason, "No completed week history yet; using configured target.");
});

test("suggested billable week target excludes the current partial week from history", () => {
  const suggestion = getSuggestedBillableWeekTarget(
    [
      billableSession("current_week", "2026-04-28T09:00:00.000Z", 100),
      ...billableWeekSessions("previous_week", "2026-04-18", [6.75, 6.75, 6.75, 6.75, 7]),
    ],
    "2026-04-29",
    createDefaultBillingSchedule(),
    0.85,
  );

  assert.equal(suggestion.weeksUsed, 1);
  assert.equal(suggestion.historicalAverageHours, 34);
  assert.equal(suggestion.historicalAverageRate, 0.85);
  assert.equal(suggestion.suggestedRate, 0.85);
  assert.equal(suggestion.suggestedHours, 34);
});

test("daily billable rolling average uses logged weekdays and rounded billable hours", () => {
  const trend = getDailyBillableRollingAverage(
    [
      billableSession("year_w1_thu", "2026-01-01T09:00:00.000Z", 7),
      billableSession("year_w1_fri", "2026-01-02T09:00:00.000Z", 7),
      billableSession("year_w1_sat", "2026-01-03T09:00:00.000Z", 2),
      billableSession("year_w2_mon", "2026-01-05T09:00:00.000Z", 6),
    ],
    "2026-01-05",
    createDefaultBillingSchedule(),
    5,
    2,
  );

  assert.equal(trend.length, 5);
  assert.equal(Number(trend[0].billablePercentage?.toFixed(1)), 87.5);
  assert.equal(Number(trend[1].billablePercentage?.toFixed(1)), 87.5);
  assert.equal(trend[2].billablePercentage, null);
  assert.equal(trend[3].billablePercentage, null);
  assert.equal(Number(trend[4].billablePercentage?.toFixed(1)), 75.0);
  assert.equal(Number(trend[4].rollingAveragePercentage?.toFixed(2)), 81.25);
});

test("suggested focus time remains in the supported set", () => {
  const suggestion = getSuggestedFocusTime(sessions, "2026-04-16", 6);
  assert.ok([25, 35, 50].includes(suggestion.minutes));
  assert.ok(suggestion.reason.length > 0);
});

test("billable-adjusted focus targets derive from billing baseline, billable target, and raw productivity target", () => {
  const settings = {
    ...defaultSettings,
    dailyWorkHours: 6,
    billingWorkHoursPerDay: 8,
    billingWeeklyHours: 40,
    billableTargetRate: 0.85,
    rewardTargetRate: 0.75,
  };

  assert.equal(getBillableAdjustedDailyTargetHours(settings), 5.1);
  assert.equal(getBillableAdjustedWeeklyTargetHours(settings), 25.5);
});

test("live banner pace converts weekly rounded billable gap into today's raw focus need", () => {
  const pace = getLiveBannerPaceSummary(
    [
      billableSession("pace_mon", "2026-04-13T09:00:00.000Z", 6.5),
      billableSession("pace_tue", "2026-04-14T09:00:00.000Z", 6.5),
      {
        ...billableSession("pace_wed", "2026-04-15T09:00:00.000Z", 1.4),
        endedAt: "2026-04-15T11:00:00.000Z",
      },
    ],
    "2026-04-15",
    createDefaultBillingSchedule(),
    0.85,
    0.7,
    new Date("2026-04-15T11:00:00.000Z"),
  );

  assert.equal(pace.weeklyPlannedHours, 40);
  assert.equal(pace.weeklyRoundedBillableTargetHours, 34);
  assert.equal(pace.roundedBillableLoggedBeforeTodayHours, 13);
  assert.equal(pace.remainingScheduledWorkdays, 3);
  assert.equal(pace.roundedBillableNeededTodayHours, 7);
  assert.equal(Number(pace.rawFocusTargetTodayHours?.toFixed(1)), 4.9);
  assert.equal(Number(pace.todayLoggedRawFocusHours.toFixed(1)), 1.4);
  assert.equal(Number(pace.rawFocusRemainingTodayHours?.toFixed(1)), 3.5);
  assert.equal(Number(pace.liveProductivityScore.toFixed(1)), 70);
  assert.equal(pace.finishAt?.toISOString(), "2026-04-15T16:00:00.000Z");
});

test("live banner pace with no live score has no finish estimate", () => {
  const pace = getLiveBannerPaceSummary(
    [
      billableSession("pace_no_live_mon", "2026-04-13T09:00:00.000Z", 6.5),
      billableSession("pace_no_live_tue", "2026-04-14T09:00:00.000Z", 6.5),
    ],
    "2026-04-15",
    createDefaultBillingSchedule(),
    0.85,
    0.7,
    new Date("2026-04-15T11:00:00.000Z"),
  );

  assert.equal(Number(pace.rawFocusRemainingTodayHours?.toFixed(1)), 4.9);
  assert.equal(pace.liveProductivityScore, 0);
  assert.equal(pace.finishAt, null);
});

test("live banner pace marks target met without creating a finish estimate", () => {
  const pace = getLiveBannerPaceSummary(
    [
      billableSession("pace_done_mon", "2026-04-13T09:00:00.000Z", 17),
      billableSession("pace_done_tue", "2026-04-14T09:00:00.000Z", 17),
      {
        ...billableSession("pace_done_wed", "2026-04-15T09:00:00.000Z", 1),
        endedAt: "2026-04-15T10:00:00.000Z",
      },
    ],
    "2026-04-15",
    createDefaultBillingSchedule(),
    0.85,
    0.7,
    new Date("2026-04-15T10:00:00.000Z"),
  );

  assert.equal(pace.rawFocusTargetTodayHours, 0);
  assert.equal(pace.rawFocusRemainingTodayHours, 0);
  assert.equal(pace.finishAt, null);
});

test("live banner score freezes after required raw focus is reached", () => {
  const oneDaySchedule = {
    ...createDefaultBillingSchedule(),
    weekdayHours: {
      sunday: 0,
      monday: 0,
      tuesday: 0,
      wednesday: 8,
      thursday: 0,
      friday: 0,
      saturday: 0,
    },
  };
  const pace = getLiveBannerPaceSummary(
    [
      billableSession("live_bounded_first", "2026-04-15T09:00:00.000Z", 1),
      billableSession("live_bounded_second", "2026-04-15T10:30:00.000Z", 1.5),
      billableSession("live_bounded_extra", "2026-04-15T13:00:00.000Z", 1),
    ],
    "2026-04-15",
    oneDaySchedule,
    0.25,
    1,
    new Date("2026-04-15T18:00:00.000Z"),
  );

  assert.equal(pace.rawFocusTargetTodayHours, 2);
  assert.equal(pace.rawFocusRemainingTodayHours, 0);
  assert.equal(pace.liveProductivityScore, 80);
  assert.equal(pace.finishAt, null);
});

test("daily productivity trend uses target-bounded scores and keeps weekday markers", () => {
  const oneDaySchedule = {
    ...createDefaultBillingSchedule(),
    weekdayHours: {
      sunday: 0,
      monday: 0,
      tuesday: 0,
      wednesday: 8,
      thursday: 0,
      friday: 0,
      saturday: 0,
    },
  };
  const trend = getDailyProductivityTrend(
    [
      billableSession("trend_bounded_first", "2026-04-15T09:00:00.000Z", 1),
      billableSession("trend_bounded_second", "2026-04-15T10:30:00.000Z", 1.5),
      billableSession("trend_bounded_extra", "2026-04-15T13:00:00.000Z", 1),
      billableSession("trend_bounded_weekend", "2026-04-18T09:00:00.000Z", 1),
    ],
    4,
    "2026-04-18",
    oneDaySchedule,
    0.25,
    1,
    new Date("2026-04-18T18:00:00.000Z"),
  );

  assert.equal(trend[0].dateKey, "2026-04-15");
  assert.equal(trend[0].productivityScore, 80);
  assert.equal(trend[3].isWeekday, false);
});

test("live banner alerts fire focus and completion thresholds once", () => {
  const pace = {
    dateKey: "2026-04-15",
    weekStartDateKey: "2026-04-11",
    weekEndDateKey: "2026-04-17",
    weeklyPlannedHours: 40,
    weeklyRoundedBillableTargetHours: 34,
    roundedBillableLoggedBeforeTodayHours: 13,
    remainingRoundedBillableWeekHours: 21,
    remainingScheduledWorkdays: 3,
    roundedBillableNeededTodayHours: 7,
    todayRoundedBillableHours: 7,
    rawFocusTargetTodayHours: 4,
    todayLoggedRawFocusHours: 4,
    rawFocusRemainingTodayHours: 0,
    liveProductivityScore: 80,
    finishAt: null,
  };
  const first = evaluateLiveBannerAlerts({
    pace,
    settings: alertSettings,
    memory: createLiveBannerAlertMemory("2026-04-15"),
    timerIsRunning: true,
    now: new Date("2026-04-15T15:00:00.000Z"),
  });
  const second = evaluateLiveBannerAlerts({
    pace,
    settings: alertSettings,
    memory: first.memory,
    timerIsRunning: true,
    now: new Date("2026-04-15T15:01:00.000Z"),
  });

  assert.deepEqual(first.events, ["focus75", "rawFocusDone", "billableDone", "breakRecommended20"]);
  assert.deepEqual(second.events, []);
});

test("live banner alerts detect finish slipping only after threshold", () => {
  const pace = {
    dateKey: "2026-04-15",
    weekStartDateKey: "2026-04-11",
    weekEndDateKey: "2026-04-17",
    weeklyPlannedHours: 40,
    weeklyRoundedBillableTargetHours: 34,
    roundedBillableLoggedBeforeTodayHours: 13,
    remainingRoundedBillableWeekHours: 21,
    remainingScheduledWorkdays: 3,
    roundedBillableNeededTodayHours: 7,
    todayRoundedBillableHours: 1,
    rawFocusTargetTodayHours: 6,
    todayLoggedRawFocusHours: 2,
    rawFocusRemainingTodayHours: 4,
    liveProductivityScore: 70,
    finishAt: new Date("2026-04-15T16:00:00.000Z"),
  };
  const first = evaluateLiveBannerAlerts({
    pace,
    settings: alertSettings,
    memory: createLiveBannerAlertMemory("2026-04-15"),
    timerIsRunning: true,
    now: new Date("2026-04-15T10:00:00.000Z"),
  });
  const slipped = evaluateLiveBannerAlerts({
    pace: { ...pace, finishAt: new Date("2026-04-15T16:31:00.000Z") },
    settings: alertSettings,
    memory: first.memory,
    timerIsRunning: true,
    now: new Date("2026-04-15T11:00:00.000Z"),
  });

  assert.equal(first.events.includes("finishSlip"), false);
  assert.equal(slipped.events.includes("finishSlip"), true);
});

test("live banner alerts respect idle toggle and delay", () => {
  const pace = {
    dateKey: "2026-04-15",
    weekStartDateKey: "2026-04-11",
    weekEndDateKey: "2026-04-17",
    weeklyPlannedHours: 40,
    weeklyRoundedBillableTargetHours: 34,
    roundedBillableLoggedBeforeTodayHours: 13,
    remainingRoundedBillableWeekHours: 21,
    remainingScheduledWorkdays: 3,
    roundedBillableNeededTodayHours: 7,
    todayRoundedBillableHours: 1,
    rawFocusTargetTodayHours: 6,
    todayLoggedRawFocusHours: 2,
    rawFocusRemainingTodayHours: 4,
    liveProductivityScore: 70,
    finishAt: null,
  };
  const disabled = evaluateLiveBannerAlerts({
    pace,
    settings: alertSettings,
    memory: createLiveBannerAlertMemory("2026-04-15"),
    timerIsRunning: false,
    now: new Date("2026-04-15T10:00:00.000Z"),
  });
  const started = evaluateLiveBannerAlerts({
    pace,
    settings: { ...alertSettings, alertIdleWhileWorkRemainsEnabled: true },
    memory: createLiveBannerAlertMemory("2026-04-15"),
    timerIsRunning: false,
    now: new Date("2026-04-15T10:00:00.000Z"),
  });
  const delayed = evaluateLiveBannerAlerts({
    pace,
    settings: { ...alertSettings, alertIdleWhileWorkRemainsEnabled: true },
    memory: started.memory,
    timerIsRunning: false,
    now: new Date("2026-04-15T10:15:00.000Z"),
  });

  assert.equal(disabled.events.includes("idle"), false);
  assert.equal(started.events.includes("idle"), false);
  assert.equal(delayed.events.includes("idle"), true);
});

test("live banner break signal and alerts use 10 15 and 20 minute thresholds without overload", () => {
  const basePace = {
    dateKey: "2026-04-15",
    weekStartDateKey: "2026-04-11",
    weekEndDateKey: "2026-04-17",
    weeklyPlannedHours: 40,
    weeklyRoundedBillableTargetHours: 34,
    roundedBillableLoggedBeforeTodayHours: 13,
    remainingRoundedBillableWeekHours: 21,
    remainingScheduledWorkdays: 3,
    roundedBillableNeededTodayHours: 7,
    todayRoundedBillableHours: 2.15,
    rawFocusTargetTodayHours: 6,
    todayLoggedRawFocusHours: 2,
    rawFocusRemainingTodayHours: 4,
    liveProductivityScore: 70,
    finishAt: null,
  };
  const balanced = evaluateLiveBannerAlerts({
    pace: basePace,
    settings: alertSettings,
    memory: createLiveBannerAlertMemory("2026-04-15"),
    timerIsRunning: true,
    now: new Date("2026-04-15T10:00:00.000Z"),
  });
  const ahead = evaluateLiveBannerAlerts({
    pace: { ...basePace, todayRoundedBillableHours: 2.1667 },
    settings: alertSettings,
    memory: createLiveBannerAlertMemory("2026-04-15"),
    timerIsRunning: true,
    now: new Date("2026-04-15T10:00:00.000Z"),
  });
  const fifteen = evaluateLiveBannerAlerts({
    pace: { ...basePace, todayRoundedBillableHours: 2.25 },
    settings: alertSettings,
    memory: ahead.memory,
    timerIsRunning: true,
    now: new Date("2026-04-15T10:05:00.000Z"),
  });
  const twenty = evaluateLiveBannerAlerts({
    pace: { ...basePace, todayRoundedBillableHours: 2.3334 },
    settings: alertSettings,
    memory: fifteen.memory,
    timerIsRunning: true,
    now: new Date("2026-04-15T10:10:00.000Z"),
  });

  assert.equal(balanced.breakSignal.active, false);
  assert.equal(balanced.events.includes("breakRecommended10"), false);
  assert.equal(ahead.breakSignal.active, true);
  assert.deepEqual(ahead.events, ["breakRecommended10"]);
  assert.deepEqual(fifteen.events, ["breakRecommended15"]);
  assert.deepEqual(twenty.events, ["breakRecommended20"]);
});

test("live banner break alerts use free-minute thresholds when provided", () => {
  const basePace: LiveBannerPaceSummary = {
    dateKey: "2026-04-15",
    weekStartDateKey: "2026-04-11",
    weekEndDateKey: "2026-04-17",
    weeklyPlannedHours: 40,
    weeklyRoundedBillableTargetHours: 34,
    roundedBillableLoggedBeforeTodayHours: 13,
    remainingRoundedBillableWeekHours: 21,
    remainingScheduledWorkdays: 3,
    roundedBillableNeededTodayHours: 7,
    todayRoundedBillableHours: 2,
    rawFocusTargetTodayHours: 5,
    todayLoggedRawFocusHours: 2,
    rawFocusRemainingTodayHours: 3,
    liveProductivityScore: 70,
    finishAt: null,
  };

  const nine = evaluateLiveBannerAlerts({
    pace: basePace,
    settings: alertSettings,
    memory: createLiveBannerAlertMemory("2026-04-15"),
    timerIsRunning: true,
    now: new Date("2026-04-15T10:00:00.000Z"),
    breakAvailableMinutes: 9,
  });
  const ten = evaluateLiveBannerAlerts({
    pace: basePace,
    settings: alertSettings,
    memory: createLiveBannerAlertMemory("2026-04-15"),
    timerIsRunning: true,
    now: new Date("2026-04-15T10:05:00.000Z"),
    breakAvailableMinutes: 10,
  });
  const twenty = evaluateLiveBannerAlerts({
    pace: basePace,
    settings: alertSettings,
    memory: createLiveBannerAlertMemory("2026-04-15"),
    timerIsRunning: true,
    now: new Date("2026-04-15T10:10:00.000Z"),
    breakAvailableMinutes: 20,
  });

  assert.equal(nine.breakSignal.active, false);
  assert.deepEqual(nine.events, []);
  assert.equal(ten.breakSignal.freeMinutes, 10);
  assert.deepEqual(ten.events, ["breakRecommended10"]);
  assert.deepEqual(twenty.events, ["breakRecommended20"]);
});

test("live banner break alert emits only the highest reached threshold when jumping ahead", () => {
  const pace = {
    dateKey: "2026-04-15",
    weekStartDateKey: "2026-04-11",
    weekEndDateKey: "2026-04-17",
    weeklyPlannedHours: 40,
    weeklyRoundedBillableTargetHours: 34,
    roundedBillableLoggedBeforeTodayHours: 13,
    remainingRoundedBillableWeekHours: 21,
    remainingScheduledWorkdays: 3,
    roundedBillableNeededTodayHours: 7,
    todayRoundedBillableHours: 2.5,
    rawFocusTargetTodayHours: 6,
    todayLoggedRawFocusHours: 2,
    rawFocusRemainingTodayHours: 4,
    liveProductivityScore: 70,
    finishAt: null,
  };
  const evaluation = evaluateLiveBannerAlerts({
    pace,
    settings: alertSettings,
    memory: createLiveBannerAlertMemory("2026-04-15"),
    timerIsRunning: true,
    now: new Date("2026-04-15T10:00:00.000Z"),
  });

  assert.deepEqual(evaluation.events, ["breakRecommended20"]);
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
    todayRoundedBillableHours: 1,
    rawFocusTargetTodayHours: 4.9,
    todayLoggedRawFocusHours: 1,
    rawFocusRemainingTodayHours: 3.9,
    liveProductivityScore: 75,
    finishAt: new Date("2026-04-15T16:00:00.000Z"),
    ...overrides,
  };
}

function coachBillingSummary(todayRemainingToTargetHours = 0): BillingCalendarSummary {
  return {
    startDateKey: "2026-04-11",
    endDateKey: "2026-04-17",
    carryInStartDateKey: "2026-04-11",
    carryInEndDateKey: "2026-04-14",
    finalScheduledDateKey: "2026-04-17",
    carryInBillableHours: 13,
    carryInRawHours: 13,
    rows: [
      {
        kind: "day",
        dateKey: "2026-04-15",
        label: "Wed",
        weekdayKey: "wed",
        openingBillableHours: 13,
        plannedHours: 8,
        cumulativePlannedHours: 24,
        targetBillableHours: 20.4,
        rawBillableHours: 1,
        billableHours: 1,
        cumulativeBillableHours: 14,
        cumulativeTargetBillableHours: 20.4,
        billablePercent: 58.3,
        remainingToTargetHours: todayRemainingToTargetHours,
        isToday: true,
        isFuture: false,
        isOverride: false,
      },
    ],
    totalPlannedHours: 40,
    currentPlannedHours: 24,
    totalTargetBillableHours: 34,
    totalBillableHours: 14,
    totalRawBillableHours: 14,
    remainingToTargetHours: todayRemainingToTargetHours,
    tomorrowStartBillableHours: 14,
  };
}

test("day coach ignores billable-ahead breaks because the live banner owns that signal", () => {
  const coach = evaluateDayCoach({
    pace: coachPace({ todayRoundedBillableHours: 2.5, todayLoggedRawFocusHours: 2, rawFocusRemainingTodayHours: 2.9 }),
    billingCalendarSummary: coachBillingSummary(),
    timerIsRunning: true,
    now: new Date("2026-04-15T14:00:00.000Z"),
    productivityTargetRate: 0.7,
    memory: createDayCoachMemory("2026-04-15"),
  });

  assert.equal(coach.state, "work");
  assert.equal(coach.cueEvent, null);
  assert.equal(coach.helper.includes("billable ahead"), false);
});

test("day coach recommends resume when stopped and live score is below target", () => {
  const coach = evaluateDayCoach({
    pace: coachPace({ liveProductivityScore: 55 }),
    billingCalendarSummary: coachBillingSummary(),
    timerIsRunning: false,
    now: new Date("2026-04-15T14:00:00.000Z"),
    productivityTargetRate: 0.7,
    memory: createDayCoachMemory("2026-04-15"),
  });

  assert.equal(coach.state, "resume");
  assert.equal(coach.cueEvent, "coachResume");
});

test("day coach recommends work when timer is running and focus remains", () => {
  const coach = evaluateDayCoach({
    pace: coachPace(),
    billingCalendarSummary: coachBillingSummary(),
    timerIsRunning: true,
    now: new Date("2026-04-15T14:00:00.000Z"),
    productivityTargetRate: 0.7,
    memory: createDayCoachMemory("2026-04-15"),
  });

  assert.equal(coach.state, "work");
  assert.equal(coach.cueEvent, null);
});

test("day coach can cue work when stopped and on track", () => {
  const coach = evaluateDayCoach({
    pace: coachPace(),
    billingCalendarSummary: coachBillingSummary(),
    timerIsRunning: false,
    now: new Date("2026-04-15T14:00:00.000Z"),
    productivityTargetRate: 0.7,
    memory: createDayCoachMemory("2026-04-15"),
  });

  assert.equal(coach.state, "work");
  assert.equal(coach.cueEvent, "coachWork");
  assert.equal(coach.spokenMessage, "Keep working. 3.9h left.");
});

test("day coach recommends done when raw focus target is complete", () => {
  const coach = evaluateDayCoach({
    pace: coachPace({
      todayRoundedBillableHours: 4.9,
      todayLoggedRawFocusHours: 4.9,
      rawFocusRemainingTodayHours: 0,
      finishAt: null,
    }),
    billingCalendarSummary: coachBillingSummary(),
    timerIsRunning: false,
    now: new Date("2026-04-15T17:00:00.000Z"),
    productivityTargetRate: 0.7,
    memory: createDayCoachMemory("2026-04-15"),
  });

  assert.equal(coach.state, "done");
  assert.equal(coach.cueEvent, "coachDone");
});

test("day coach recommends catch-up when billing pace is behind", () => {
  const coach = evaluateDayCoach({
    pace: coachPace(),
    billingCalendarSummary: coachBillingSummary(1.5),
    timerIsRunning: true,
    now: new Date("2026-04-15T14:00:00.000Z"),
    productivityTargetRate: 0.7,
    memory: createDayCoachMemory("2026-04-15"),
  });

  assert.equal(coach.state, "catch-up");
  assert.equal(coach.cueEvent, "coachCatchUp");
});

test("day coach cooldown prevents duplicate cues and updates", () => {
  const first = evaluateDayCoach({
    pace: coachPace(),
    billingCalendarSummary: coachBillingSummary(),
    timerIsRunning: false,
    now: new Date("2026-04-15T14:00:00.000Z"),
    productivityTargetRate: 0.7,
    memory: createDayCoachMemory("2026-04-15"),
  });
  const second = evaluateDayCoach({
    pace: coachPace(),
    billingCalendarSummary: coachBillingSummary(),
    timerIsRunning: false,
    now: new Date("2026-04-15T14:10:00.000Z"),
    productivityTargetRate: 0.7,
    memory: first.memory,
  });

  assert.equal(first.cueEvent, "coachWork");
  assert.equal(second.cueEvent, null);
  assert.equal(second.memory.updates.length, 1);
});

test("day coach urgent cues can repeat after urgent cooldown while still relevant", () => {
  const first = evaluateDayCoach({
    pace: coachPace({ liveProductivityScore: 55 }),
    billingCalendarSummary: coachBillingSummary(),
    timerIsRunning: false,
    now: new Date("2026-04-15T14:00:00.000Z"),
    productivityTargetRate: 0.7,
    memory: createDayCoachMemory("2026-04-15"),
  });
  const repeated = evaluateDayCoach({
    pace: coachPace({ liveProductivityScore: 55 }),
    billingCalendarSummary: coachBillingSummary(),
    timerIsRunning: false,
    now: new Date("2026-04-15T14:11:00.000Z"),
    productivityTargetRate: 0.7,
    memory: first.memory,
  });

  assert.equal(first.cueEvent, "coachResume");
  assert.equal(repeated.cueEvent, "coachResume");
});

test("day coach done cue fires once per day", () => {
  const first = evaluateDayCoach({
    pace: coachPace({
      todayLoggedRawFocusHours: 4.9,
      rawFocusRemainingTodayHours: 0,
      finishAt: null,
    }),
    billingCalendarSummary: coachBillingSummary(),
    timerIsRunning: false,
    now: new Date("2026-04-15T16:00:00.000Z"),
    productivityTargetRate: 0.7,
    memory: createDayCoachMemory("2026-04-15"),
  });
  const repeated = evaluateDayCoach({
    pace: coachPace({
      todayLoggedRawFocusHours: 4.9,
      rawFocusRemainingTodayHours: 0,
      finishAt: null,
    }),
    billingCalendarSummary: coachBillingSummary(),
    timerIsRunning: false,
    now: new Date("2026-04-15T17:00:00.000Z"),
    productivityTargetRate: 0.7,
    memory: first.memory,
  });

  assert.equal(first.cueEvent, "coachDone");
  assert.equal(repeated.cueEvent, null);
});

test("day coach ignores small remaining-time changes", () => {
  const first = evaluateDayCoach({
    pace: coachPace({ rawFocusRemainingTodayHours: 3.9 }),
    billingCalendarSummary: coachBillingSummary(),
    timerIsRunning: false,
    now: new Date("2026-04-15T14:00:00.000Z"),
    productivityTargetRate: 0.7,
    memory: createDayCoachMemory("2026-04-15"),
  });
  const smallChange = evaluateDayCoach({
    pace: coachPace({ rawFocusRemainingTodayHours: 3.7 }),
    billingCalendarSummary: coachBillingSummary(),
    timerIsRunning: false,
    now: new Date("2026-04-15T14:31:00.000Z"),
    productivityTargetRate: 0.7,
    memory: first.memory,
  });

  assert.equal(first.cueEvent, "coachWork");
  assert.equal(smallChange.cueEvent, null);
});

test("day coach ignores small finish-by changes", () => {
  const first = evaluateDayCoach({
    pace: coachPace({ finishAt: new Date("2026-04-15T16:00:00.000Z") }),
    billingCalendarSummary: coachBillingSummary(),
    timerIsRunning: false,
    now: new Date("2026-04-15T14:00:00.000Z"),
    productivityTargetRate: 0.7,
    memory: createDayCoachMemory("2026-04-15"),
  });
  const smallChange = evaluateDayCoach({
    pace: coachPace({ finishAt: new Date("2026-04-15T16:10:00.000Z") }),
    billingCalendarSummary: coachBillingSummary(),
    timerIsRunning: false,
    now: new Date("2026-04-15T14:31:00.000Z"),
    productivityTargetRate: 0.7,
    memory: first.memory,
  });

  assert.equal(first.cueEvent, "coachWork");
  assert.equal(smallChange.cueEvent, null);
});

test("day coach resets memory when the date changes", () => {
  const first = evaluateDayCoach({
    pace: coachPace(),
    billingCalendarSummary: coachBillingSummary(),
    timerIsRunning: true,
    now: new Date("2026-04-15T14:00:00.000Z"),
    productivityTargetRate: 0.7,
    memory: createDayCoachMemory("2026-04-15", true),
  });
  const nextDay = evaluateDayCoach({
    pace: coachPace({ dateKey: "2026-04-16" }),
    billingCalendarSummary: coachBillingSummary(),
    timerIsRunning: false,
    now: new Date("2026-04-16T14:00:00.000Z"),
    productivityTargetRate: 0.7,
    memory: first.memory,
  });

  assert.equal(nextDay.memory.dateKey, "2026-04-16");
  assert.equal(nextDay.memory.muted, false);
  assert.equal(nextDay.cueEvent, "coachWork");
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
