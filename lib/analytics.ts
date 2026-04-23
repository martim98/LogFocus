import { billingWeekdayOrder, defaultSettings } from "@/lib/domain";
import type { BillingSchedule, BillingWeekdayKey, FocusSession, PlanItem, Task, TimerMode } from "@/lib/domain";
import { endOfDayIso, formatMinutes, getDateKey, startOfDayIso } from "@/lib/utils";

export function roundUpToQuarterHour(hours: number) {
  return Math.ceil(hours / 0.25) * 0.25;
}

export type RecentTaskSuggestion = {
  taskId: string | null;
  projectId: string | null;
  title: string;
  lastUsedAt: string;
};

export type FocusTimeSuggestion = {
  minutes: 25 | 35 | 50;
  reason: string;
};

type BillableEntry = {
  project: string;
  task: string;
  rawHours: number;
  roundedHours: number;
};

type BillableSource = {
  projectName: string | null;
  taskName: string | null;
  actualDurationSec: number;
};

type BillableDaySummary = {
  dateKey: string;
  entries: BillableEntry[];
  billableHours: number;
  totalRawHours: number;
};

export type BillableProgressToNow = {
  startDateKey: string;
  dateKey: string;
  actualBillableHours: number;
  expectedBillableHours: number;
  expectedBillableHoursPerHour: number;
  deltaHours: number;
  elapsedTargetHours: number;
  targetBillableRate: number;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export type BillingCalendarRow = {
  kind: "carryIn" | "day";
  dateKey: string;
  label: string;
  weekdayKey: BillingWeekdayKey | null;
  openingBillableHours: number;
  plannedHours: number;
  cumulativePlannedHours: number;
  targetBillableHours: number;
  rawBillableHours: number;
  billableHours: number;
  cumulativeBillableHours: number;
  cumulativeTargetBillableHours: number;
  billablePercent: number | null;
  remainingToTargetHours: number | null;
  isToday: boolean;
  isFuture: boolean;
  isOverride: boolean;
};

export type BillingCalendarSummary = {
  startDateKey: string;
  endDateKey: string;
  carryInStartDateKey: string;
  carryInEndDateKey: string;
  finalScheduledDateKey: string;
  carryInBillableHours: number;
  carryInRawHours: number;
  rows: BillingCalendarRow[];
  totalPlannedHours: number;
  currentPlannedHours: number;
  totalTargetBillableHours: number;
  totalBillableHours: number;
  totalRawBillableHours: number;
  remainingToTargetHours: number;
  tomorrowStartBillableHours: number | null;
};

export function getBillingWeekdayKey(date: Date | string) {
  const resolved = typeof date === "string" ? new Date(`${date}T12:00:00Z`) : new Date(date);
  return billingWeekdayOrder[resolved.getUTCDay()].key;
}

export function getBillingWeekdayLabel(date: Date | string) {
  const resolved = typeof date === "string" ? new Date(`${date}T12:00:00Z`) : new Date(date);
  return billingWeekdayOrder[resolved.getUTCDay()].label;
}

export function getBillingScheduledHoursForDate(schedule: BillingSchedule, dateKey: string) {
  const override = schedule.dateOverrides[dateKey];
  if (override != null) {
    return override;
  }

  const weekdayKey = getBillingWeekdayKey(dateKey);
  return schedule.weekdayHours[weekdayKey];
}

function getBillingCalendarWeekRange(dateKey = getDateKey()) {
  const midpoint = new Date(`${dateKey}T12:00:00Z`);
  const daysSinceMonday = (midpoint.getUTCDay() + 6) % 7;
  const startDateKey = shiftDateKey(dateKey, -daysSinceMonday);
  const endDateKey = shiftDateKey(startDateKey, 4);
  return { startDateKey, endDateKey };
}

function getBillingCalendarVisibleDateKeys(dateKey = getDateKey()) {
  const { startDateKey, endDateKey } = getBillingCalendarWeekRange(dateKey);
  return getDateKeysInRange(startDateKey, endDateKey);
}

export function formatHoursDecimal(hours: number) {
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 2)}h`;
}

export function formatHoursOneDecimal(value: number) {
  return `${value.toFixed(1)}h`;
}

export function formatSecondsToHoursMinutes(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function getSessionsInRange(sessions: FocusSession[], startIso: string, endIso: string) {
  return sessions.filter((session) => session.startedAt >= startIso && session.startedAt <= endIso);
}

export function getDaySessions(sessions: FocusSession[], dateKey = getDateKey()) {
  return getSessionsInRange(sessions, startOfDayIso(dateKey), endOfDayIso(dateKey));
}

export function getFocusSessions(sessions: FocusSession[]) {
  return sessions.filter((session) => session.mode === "focus");
}

export function getLoggedFocusSessions(sessions: FocusSession[]) {
  return getFocusSessions(sessions);
}

export function getCompletedFocusSessions(sessions: FocusSession[]) {
  return getFocusSessions(sessions).filter((session) => session.completed);
}

export function getDayFocusSessions(sessions: FocusSession[], dateKey = getDateKey()) {
  return getFocusSessions(getDaySessions(sessions, dateKey));
}

export function sumActualDurationSec(sessions: FocusSession[]) {
  return sessions.reduce((total, session) => total + session.actualDurationSec, 0);
}

export function countTasksByStatus(tasks: Task[], status: Task["status"]) {
  return tasks.filter((task) => task.status === status).length;
}

export function sumTaskHoursByStatus(tasks: Task[], status: Task["status"] | "not-done") {
  return tasks
    .filter((task) => (status === "not-done" ? task.status !== "done" : task.status === status))
    .reduce((total, task) => total + task.hours, 0);
}

export function getDateKeysInRange(startDateKey: string, endDateKey: string) {
  if (endDateKey < startDateKey) {
    return [];
  }

  const start = new Date(`${startDateKey}T00:00:00Z`);
  const end = new Date(`${endDateKey}T00:00:00Z`);
  const keys: string[] = [];

  for (let current = new Date(start); current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
    keys.push(current.toISOString().slice(0, 10));
  }

  return keys;
}

export function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getWorkweekBounds(date = new Date(), workweekDays = 5) {
  const start = new Date(date);
  const day = start.getDay();
  const daysSinceMonday = (day + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + (workweekDays - 1));
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function getRemainingWorkdays(date = new Date(), workweekDays = 5) {
  const day = date.getDay();
  if (day === 0 || day === 6) {
    return 0;
  }

  return Math.max(0, workweekDays - ((day + 6) % 7));
}

function getWorkweekDateRange(dateKey = getDateKey()) {
  const midpoint = new Date(`${dateKey}T12:00:00Z`);
  const daysSinceMonday = (midpoint.getUTCDay() + 6) % 7;
  const weekStartDateKey = shiftDateKey(dateKey, -daysSinceMonday);
  const carryInStartDateKey = shiftDateKey(weekStartDateKey, -2);

  return {
    carryInStartDateKey,
    weekStartDateKey,
    endDateKey: dateKey,
  };
}

function parseTimeOfDay(value: string) {
  const [hourPart, minutePart] = value.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);

  return {
    hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 0,
    minute: Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0,
  };
}

function getBillingWeekCutoff(now: Date, weekEndDay: number, weekEndTime: string) {
  const { hour, minute } = parseTimeOfDay(weekEndTime);
  const cutoff = new Date(now);
  const daysUntilCutoff = (weekEndDay - cutoff.getDay() + 7) % 7;
  cutoff.setDate(cutoff.getDate() + daysUntilCutoff);
  cutoff.setHours(hour, minute, 0, 0);

  if (cutoff <= now) {
    cutoff.setDate(cutoff.getDate() + 7);
  }

  return cutoff;
}

function getBillableDaySummariesInTimeRange(sessions: FocusSession[], startIso: string, endIso: string) {
  const grouped = new Map<string, BillableSource[]>();
  const orderedSessions = getSessionsInRange(sessions, startIso, endIso).slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  for (const session of orderedSessions) {
    const dateKey = getDateKey(new Date(session.startedAt));
    const bucket = grouped.get(dateKey);
    const source: BillableSource = {
      projectName: session.projectName,
      taskName: session.taskName,
      actualDurationSec: session.actualDurationSec,
    };

    if (bucket) {
      bucket.push(source);
    } else {
      grouped.set(dateKey, [source]);
    }
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateKey, sources]) => ({
      dateKey,
      ...summarizeBillableEntries(buildBillableEntries(sources)),
    }));
}

export function getWorkweekLoggedHours(sessions: FocusSession[], dateKey = getDateKey()) {
  const { carryInStartDateKey, endDateKey } = getWorkweekDateRange(dateKey);
  const daySessions = getSessionsInRange(sessions, startOfDayIso(carryInStartDateKey), endOfDayIso(endDateKey));
  return sumActualDurationSec(getFocusSessions(daySessions)) / 3600;
}

export function formatFinishAt(value: Date | null) {
  if (!value) return "No pace yet";
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatBillingWeekLabel(startDateKey: string, endDateKey: string) {
  const start = new Date(`${startDateKey}T00:00:00`);
  const end = new Date(`${endDateKey}T00:00:00`);
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString([], options)} - ${end.toLocaleDateString([], options)}`;
}

export function isBillableProjectTask(projectName: string | null, taskName: string | null) {
  const project = normalizeText(projectName);
  const task = normalizeText(taskName);

  if (project === "training") return false;
  if (project === "admin") return task === "general admin";
  return true;
}

function normalizeBillableBucket(projectName: string | null, taskName: string | null) {
  const project = (projectName ?? "Unassigned").trim() || "Unassigned";
  const task = (taskName ?? "Unassigned").trim() || "Unassigned";

  return {
    project,
    task,
    key: `${normalizeText(project)}::${normalizeText(task)}`,
    billable: isBillableProjectTask(project, task),
  };
}

export function buildActiveTimerSessionFragment(params: {
  startedAt: string | null;
  mode: TimerMode;
  projectName: string | null;
  taskName: string | null;
  actualDurationSec: number;
}) {
  if (!params.startedAt || params.mode !== "focus" || params.actualDurationSec <= 0) {
    return null;
  }

  return {
    projectName: params.projectName ?? "Unassigned",
    taskName: params.taskName ?? "Unassigned",
    actualDurationSec: params.actualDurationSec,
  };
}

function resolveDayFocusStats(sessions: FocusSession[], dateKey = getDateKey()) {
  const focusSessions = getDayFocusSessions(sessions, dateKey).slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const focusSeconds = sumActualDurationSec(focusSessions);
  const focusMinutes = Math.round(focusSeconds / 60);

  return {
    focusSessions,
    focusSeconds,
    focusMinutes,
  };
}

export function resolveProjectTasks(projectId: string, projectTitle: string, tasks: Task[]) {
  const projectLabel = normalizeText(projectTitle);
  return tasks.filter((task) => task.projectId === projectId || normalizeText(task.project) === projectLabel);
}

export function resolveProjectSessions(projectId: string, projectTitle: string, sessions: FocusSession[], tasks: Task[]) {
  const projectTaskIds = new Set(resolveProjectTasks(projectId, projectTitle, tasks).map((task) => task.id));
  return sessions.filter((session) => {
    if (session.projectId) {
      return session.projectId === projectId;
    }
    return session.taskId ? projectTaskIds.has(session.taskId) : false;
  });
}

function buildBillableEntries(sources: BillableSource[]) {
  const grouped = new Map<string, BillableEntry>();

  for (const source of sources) {
    const bucket = normalizeBillableBucket(source.projectName, source.taskName);
    if (!bucket.billable) continue;

    const nextHours = source.actualDurationSec / 3600;
    const existing = grouped.get(bucket.key);

    if (existing) {
      existing.rawHours += nextHours;
    } else {
      grouped.set(bucket.key, {
        project: bucket.project,
        task: bucket.task,
        rawHours: nextHours,
        roundedHours: 0,
      });
    }
  }

  return Array.from(grouped.values())
    .map((entry) => ({ ...entry, roundedHours: roundUpToQuarterHour(entry.rawHours) }))
    .sort((a, b) => {
      if (b.roundedHours !== a.roundedHours) return b.roundedHours - a.roundedHours;
      return `${a.project} ${a.task}`.localeCompare(`${b.project} ${b.task}`);
    });
}

function summarizeBillableEntries(entries: BillableEntry[]) {
  return {
    entries,
    billableHours: entries.reduce((total, entry) => total + entry.roundedHours, 0),
    totalRawHours: entries.reduce((total, entry) => total + entry.rawHours, 0),
  };
}

function getBillableDayEntries(sessions: FocusSession[], dateKey: string) {
  return buildBillableEntries(
    getDayFocusSessions(sessions, dateKey)
      .slice()
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .map((session) => ({
        projectName: session.projectName,
        taskName: session.taskName,
        actualDurationSec: session.actualDurationSec,
      })),
  );
}

function getBillableDaySummariesInRange(sessions: FocusSession[], startDateKey: string, endDateKey: string) {
  return getDateKeysInRange(startDateKey, endDateKey).map((dateKey) => getBillableDaySummary(sessions, dateKey));
}

function mergeBillableDaySummaries(daySummaries: BillableDaySummary[]) {
  const grouped = new Map<string, BillableEntry>();

  for (const daySummary of daySummaries) {
    for (const entry of daySummary.entries) {
      const key = `${normalizeText(entry.project)}::${normalizeText(entry.task)}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.rawHours += entry.rawHours;
        existing.roundedHours += entry.roundedHours;
      } else {
        grouped.set(key, { ...entry });
      }
    }
  }

  const entries = Array.from(grouped.values()).sort((a, b) => {
    if (b.roundedHours !== a.roundedHours) return b.roundedHours - a.roundedHours;
    return `${a.project} ${a.task}`.localeCompare(`${b.project} ${b.task}`);
  });
  return summarizeBillableEntries(entries);
}

export function getTodayStats(sessions: FocusSession[], tasks: Task[], planItems: PlanItem[], today = getDateKey()) {
  const todaySessions = getDaySessions(sessions, today);
  const loggedFocus = getLoggedFocusSessions(todaySessions);
  const completedFocus = getCompletedFocusSessions(todaySessions);
  const focusMinutes = Math.round(sumActualDurationSec(loggedFocus) / 60);

  return {
    focusMinutes,
    focusLabel: formatMinutes(focusMinutes),
    completedSessions: completedFocus.length,
    loggedSessions: loggedFocus.length,
    tasksDone: countTasksByStatus(tasks, "done"),
    totalTasks: tasks.length,
    donePlan: planItems.filter((item) => item.status === "done").length,
    totalPlan: planItems.length,
    remainingPomodoros: sumTaskHoursByStatus(tasks, "not-done"),
  };
}

export function getProjectStats(projectId: string, projectTitle: string, sessions: FocusSession[], tasks: Task[]) {
  const projectTasks = resolveProjectTasks(projectId, projectTitle, tasks);
  const projectSessions = resolveProjectSessions(projectId, projectTitle, sessions, tasks);
  const loggedFocus = getLoggedFocusSessions(projectSessions);
  const completedFocus = getCompletedFocusSessions(projectSessions);
  const focusMinutes = Math.round(sumActualDurationSec(loggedFocus) / 60);

  return {
    focusMinutes,
    focusLabel: formatMinutes(focusMinutes),
    completedSessions: completedFocus.length,
    loggedSessions: loggedFocus.length,
    tasksDone: countTasksByStatus(projectTasks, "done"),
    totalTasks: projectTasks.length,
    remainingPomodoros: sumTaskHoursByStatus(projectTasks, "not-done"),
  };
}

export function estimateFinishTime(remainingFocusBlocks: number, focusMinutes: number) {
  if (remainingFocusBlocks <= 0) return "Clear";
  const finish = new Date(Date.now() + remainingFocusBlocks * focusMinutes * 60 * 1000);
  return finish.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function getLiveProductivityProjection(
  sessions: FocusSession[],
  dateKey = getDateKey(),
  targetWorkHours = defaultSettings.dailyWorkHours,
) {
  const now = new Date();
  const startOfDay = new Date(`${dateKey}T00:00:00`);
  const endOfDay = new Date(`${dateKey}T23:59:59.999`);
  const { focusSeconds } = resolveDayFocusStats(sessions, dateKey);
  const elapsedSec = Math.max(1, Math.floor((Math.min(now.getTime(), endOfDay.getTime()) - startOfDay.getTime()) / 1000));
  const productiveRate = focusSeconds / elapsedSec;
  const projectedWorkSec = productiveRate * Math.max(0, Math.floor((endOfDay.getTime() - startOfDay.getTime()) / 1000));
  const projectedWorkHours = projectedWorkSec / 3600;

  return {
    currentWorkHours: focusSeconds / 3600,
    projectedWorkHours,
    productiveRate,
    targetWorkHours,
    remainingToTargetHours: Math.max(0, targetWorkHours - projectedWorkHours),
  };
}

export function getLiveProductivitySummary(
  sessions: FocusSession[],
  dateKey = getDateKey(),
  targetWorkHours = defaultSettings.dailyWorkHours,
) {
  const now = new Date();
  const { focusSeconds } = resolveDayFocusStats(sessions, dateKey);
  const startOfDayMs = new Date(`${dateKey}T00:00:00`).getTime();
  const endOfDayMs = new Date(`${dateKey}T23:59:59.999`).getTime();
  const elapsedSec = Math.max(1, Math.floor((Math.min(now.getTime(), endOfDayMs) - startOfDayMs) / 1000));
  const liveScore = Math.max(0, Math.min(1, focusSeconds / elapsedSec));
  const loggedHours = focusSeconds / 3600;
  const hoursToTarget = Math.max(0, targetWorkHours - loggedHours);
  const hoursNeededAtCurrentPace = liveScore > 0 ? hoursToTarget / liveScore : null;

  return {
    liveScore,
    loggedHours,
    hoursToTarget,
    hoursNeededAtCurrentPace,
    finishAt: hoursNeededAtCurrentPace == null ? null : new Date(now.getTime() + hoursNeededAtCurrentPace * 3600 * 1000),
    targetWorkHours,
  };
}

export function getSuggestedFocusTime(
  sessions: FocusSession[],
  dateKey = getDateKey(),
  targetWorkHours = defaultSettings.dailyWorkHours,
): FocusTimeSuggestion {
  const todaySessions = getDayFocusSessions(sessions, dateKey);
  if (todaySessions.length === 0) {
    return { minutes: 25, reason: "No focus logged yet today, so 25 minutes is the safest default." };
  }

  const totalMinutes = Math.round(sumActualDurationSec(todaySessions) / 60);
  const averageMinutes = totalMinutes / todaySessions.length;
  const liveSummary = getLiveProductivitySummary(sessions, dateKey, targetWorkHours);

  let minutes: 25 | 35 | 50 = 25;
  let reason = "Keeping the next block at 25 minutes is the safest choice.";

  if (totalMinutes >= 45) {
    if (averageMinutes >= 40) {
      minutes = 50;
      reason = `Your recent blocks average ${Math.round(averageMinutes)} minutes, so 50 minutes should fit.`;
    } else if (averageMinutes >= 28) {
      minutes = 35;
      reason = `Your recent blocks average ${Math.round(averageMinutes)} minutes, so 35 minutes is a better match.`;
    }
  }

  if (liveSummary.hoursToTarget <= 0.75) {
    minutes = 25;
    reason = "You are close to today’s target, so 25 minutes keeps the next block easy to finish.";
  } else if (minutes === 25 && averageMinutes >= 28 && liveSummary.hoursToTarget >= 2.5) {
    minutes = 35;
    reason = `You still have ${formatMinutes(Math.round(liveSummary.hoursToTarget * 60))} left today, so 35 minutes is a good stretch.`;
  } else if (minutes === 35 && liveSummary.hoursToTarget >= 4 && averageMinutes >= 35) {
    minutes = 50;
    reason = "You have plenty left today and your recent blocks support a 50-minute run.";
  }

  return { minutes, reason };
}

export function getTaskTimeLogged(taskId: string, sessions: FocusSession[]) {
  return Math.round(sumActualDurationSec(getLoggedFocusSessions(sessions).filter((session) => session.taskId === taskId)) / 60);
}

export function getRecentTaskSuggestions(
  projectId: string | null,
  projectTitle: string,
  sessions: FocusSession[],
  tasks: Task[],
  limit = 5,
): RecentTaskSuggestion[] {
  const projectLabel = normalizeText(projectTitle);
  const projectTasks = projectId ? resolveProjectTasks(projectId, projectTitle, tasks) : tasks.filter((task) => normalizeText(task.project) === projectLabel);
  const projectTaskIds = new Set(projectTasks.map((task) => task.id));
  const recentSuggestions = new Map<string, RecentTaskSuggestion>();
  const sortedSessions = getLoggedFocusSessions(sessions).slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  for (const session of sortedSessions) {
    const sessionProjectMatches =
      (projectId && session.projectId === projectId) ||
      normalizeText(session.projectName) === projectLabel ||
      (session.taskId ? projectTaskIds.has(session.taskId) : false);

    if (!sessionProjectMatches) continue;

    const task = session.taskId ? tasks.find((entry) => entry.id === session.taskId) ?? null : null;
    const title = (task?.title ?? session.taskName ?? "").trim();
    if (!title) continue;

    const key = normalizeText(title);
    if (!recentSuggestions.has(key)) {
      recentSuggestions.set(key, {
        taskId: task?.id ?? session.taskId ?? null,
        projectId: task?.projectId ?? session.projectId ?? projectId,
        title,
        lastUsedAt: session.startedAt,
      });
    }

    if (recentSuggestions.size >= limit) break;
  }

  return Array.from(recentSuggestions.values()).slice(0, limit);
}

export function getDailyProductivity(sessions: FocusSession[], dateKey = getDateKey()) {
  const daySessions = getDaySessions(sessions, dateKey).slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  if (daySessions.length === 0) return null;

  const firstSession = daySessions[0];
  const lastSession = daySessions[daySessions.length - 1];
  const startTime = new Date(firstSession.startedAt).getTime();
  const isToday = dateKey === getDateKey();
  const endTime = isToday ? Date.now() : new Date(lastSession.endedAt).getTime();
  const totalElapsedSec = Math.max(0, Math.floor((endTime - startTime) / 1000));
  const workTimeSec = sumActualDurationSec(getFocusSessions(daySessions));
  const inefficiencySec = Math.max(0, totalElapsedSec - workTimeSec);

  return {
    startTime: firstSession.startedAt,
    endTime: isToday ? new Date(endTime).toISOString() : lastSession.endedAt,
    totalElapsedSec,
    workTimeSec,
    inefficiencySec,
    productivityScore: totalElapsedSec > 0 ? (workTimeSec / totalElapsedSec) * 100 : 0,
    isToday,
  };
}

export function buildTimeline(sessions: FocusSession[], days: number) {
  const todayKey = getDateKey();
  return Array.from({ length: days }, (_, index) => {
    const dateKey = shiftDateKey(todayKey, -(days - index - 1));
    const daySessions = getDayFocusSessions(sessions, dateKey);
    return {
      date: dateKey.slice(5),
      minutes: Math.round(sumActualDurationSec(daySessions) / 60),
      sessions: daySessions.length,
    };
  });
}

export function getBillableDaySummary(
  sessions: FocusSession[],
  dateKey = getDateKey(),
  targetWorkHours = defaultSettings.billingWorkHoursPerDay,
  targetBillableRate = defaultSettings.billableTargetRate,
) {
  const entries = getBillableDayEntries(sessions, dateKey);
  const { billableHours, totalRawHours } = summarizeBillableEntries(entries);
  const targetBillableHours = targetWorkHours * targetBillableRate;

  return {
    dateKey,
    entries,
    billableHours,
    totalRawHours,
    billableRate: targetWorkHours > 0 ? billableHours / targetWorkHours : 0,
    targetBillableRate,
    targetWorkHours,
    targetBillableHours,
    distanceToTarget: targetBillableHours - billableHours,
    isOnTarget: billableHours >= targetBillableHours,
  };
}

export function getBillingWeekRange(dateKey = getDateKey()) {
  const anchor = new Date(`${dateKey}T00:00:00Z`);
  const daysSinceSaturday = (anchor.getUTCDay() + 1) % 7;
  const start = new Date(anchor);
  start.setUTCDate(anchor.getUTCDate() - daysSinceSaturday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return {
    startDateKey: start.toISOString().slice(0, 10),
    endDateKey: end.toISOString().slice(0, 10),
  };
}

export function getBillableWeekSummary(
  sessions: FocusSession[],
  dateKey = getDateKey(),
  targetWorkHours = defaultSettings.billingWeeklyHours,
) {
  const { startDateKey, endDateKey } = getBillingWeekRange(dateKey);
  const daySummaries = getBillableDaySummariesInRange(sessions, startDateKey, endDateKey);
  const { entries, billableHours, totalRawHours } = mergeBillableDaySummaries(daySummaries);
  const weekSessions = getSessionsInRange(sessions, startOfDayIso(startDateKey), endOfDayIso(endDateKey));
  const currentDateKey = dateKey < startDateKey ? startDateKey : dateKey > endDateKey ? endDateKey : dateKey;
  const elapsedDays =
    Math.max(1, Math.floor((Date.parse(endOfDayIso(currentDateKey)) - Date.parse(startOfDayIso(startDateKey))) / (24 * 60 * 60 * 1000)) + 1);
  const completedDays = Math.min(7, elapsedDays);
  const projectedHours = (billableHours / completedDays) * 7;

  return {
    startDateKey,
    endDateKey,
    entries,
    billableHours,
    totalRawHours,
    targetBillableHours: targetWorkHours,
    billablePercentage: targetWorkHours > 0 ? (billableHours / targetWorkHours) * 100 : 0,
    rawBillablePercentage: targetWorkHours > 0 ? (totalRawHours / targetWorkHours) * 100 : 0,
    distanceToTarget: targetWorkHours - billableHours,
    remainingHours: Math.max(0, targetWorkHours - billableHours),
    isOnTarget: billableHours >= targetWorkHours,
    currentPaceHoursPerDay: billableHours / completedDays,
    projectedHours,
    trendHours: projectedHours - targetWorkHours,
    trendDeltaHours: projectedHours - billableHours,
    daysCovered: completedDays,
    daysRemaining: Math.max(0, 7 - completedDays),
    weekSessions,
  };
}

export function getBillableWeekPaceToTarget(
  sessions: FocusSession[],
  dateKey = getDateKey(),
  targetWorkHours = defaultSettings.billingWeeklyHours,
  targetBillableRate = defaultSettings.billableTargetRate,
) {
  const { startDateKey, endDateKey } = getBillingWeekRange(dateKey);
  const targetBillableHours = targetWorkHours * targetBillableRate;
  const priorDaySummaries = getBillableDaySummariesInRange(sessions, startDateKey, shiftDateKey(dateKey, -1));
  const billableHoursBeforeToday = priorDaySummaries.reduce((total, summary) => total + summary.billableHours, 0);
  const remainingBillableHours = Math.max(0, targetBillableHours - billableHoursBeforeToday);
  const daysRemainingIncludingToday =
    Math.max(1, Math.floor((Date.parse(endOfDayIso(endDateKey)) - Date.parse(startOfDayIso(dateKey))) / (24 * 60 * 60 * 1000)) + 1);

  return {
    startDateKey,
    endDateKey,
    targetWorkHours,
    targetBillableRate,
    targetBillableHours,
    billableHoursBeforeToday,
    remainingBillableHours,
    daysRemainingIncludingToday,
    hoursPerDayNeeded: remainingBillableHours / daysRemainingIncludingToday,
  };
}

export function getWorkweekBillableSummary(
  sessions: FocusSession[],
  dateKey = getDateKey(),
  targetWorkHoursPerDay = defaultSettings.dailyWorkHours,
  workdaysPerWeek = defaultSettings.workweekDays,
) {
  const { carryInStartDateKey: startDateKey, endDateKey } = getWorkweekDateRange(dateKey);
  const daySummaries = getBillableDaySummariesInRange(sessions, startDateKey, endDateKey);
  const { entries, billableHours } = mergeBillableDaySummaries(daySummaries);
  const currentDate = new Date(`${dateKey}T12:00:00Z`);
  const daysSinceMonday = (currentDate.getUTCDay() + 6) % 7;
  const daysCovered = Math.min(workdaysPerWeek, daysSinceMonday + 1);

  return {
    startDateKey,
    endDateKey,
    entries,
    billableHours,
    daysCovered,
    targetHoursThroughToday: daysCovered * targetWorkHoursPerDay,
    isOnTarget: billableHours >= daysCovered * targetWorkHoursPerDay,
  };
}

export function getWorkweekBillableProgressToNow(
  sessions: FocusSession[],
  dateKey = getDateKey(),
  targetWorkHoursPerDay = defaultSettings.billingWorkHoursPerDay,
  targetBillableRate = defaultSettings.billableTargetRate,
  workdaysPerWeek = defaultSettings.workweekDays,
  weekEndDay = defaultSettings.billingWeekEndDay,
  weekEndTime = defaultSettings.billingWeekEndTime,
  now = new Date(),
): BillableProgressToNow {
  const periodEnd = getBillingWeekCutoff(now, weekEndDay, weekEndTime);
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - 7);
  periodStart.setHours(periodStart.getHours(), periodStart.getMinutes(), 0, 0);

  const actualSessions = getSessionsInRange(sessions, periodStart.toISOString(), now.toISOString()).slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const daySummaries = getBillableDaySummariesInTimeRange(sessions, periodStart.toISOString(), now.toISOString());
  const actualBillableHours = mergeBillableDaySummaries(daySummaries).billableHours;
  const firstSession = actualSessions[0] ?? null;
  const effectiveStart = firstSession ? new Date(firstSession.startedAt) : periodStart;
  const totalTargetHours = targetWorkHoursPerDay * workdaysPerWeek;
  const expectedWindowMs = Math.max(1, periodEnd.getTime() - effectiveStart.getTime());
  const elapsedMs = Math.max(0, Math.min(now.getTime(), periodEnd.getTime()) - effectiveStart.getTime());
  const elapsedTargetHours = totalTargetHours * (elapsedMs / expectedWindowMs);
  const expectedBillableHours = elapsedTargetHours * targetBillableRate;
  const expectedBillableHoursPerHour = (totalTargetHours * targetBillableRate) / (expectedWindowMs / (60 * 60 * 1000));

  return {
    startDateKey: getDateKey(effectiveStart),
    dateKey,
    actualBillableHours,
    expectedBillableHours,
    expectedBillableHoursPerHour,
    deltaHours: actualBillableHours - expectedBillableHours,
    elapsedTargetHours,
    targetBillableRate,
  };
}

export function getBillingCalendarSummary(
  sessions: FocusSession[],
  dateKey = getDateKey(),
  schedule: BillingSchedule = defaultSettings.billingSchedule,
  targetBillableRate = defaultSettings.billableTargetRate,
): BillingCalendarSummary {
  const { startDateKey, endDateKey } = getBillingCalendarWeekRange(dateKey);
  const carryInStartDateKey = shiftDateKey(startDateKey, -2);
  const carryInEndDateKey = shiftDateKey(startDateKey, -1);
  const carryInSummary = mergeBillableDaySummaries(getBillableDaySummariesInRange(sessions, carryInStartDateKey, carryInEndDateKey));
  const visibleDateKeys = getBillingCalendarVisibleDateKeys(dateKey);
  const totalPlannedHours = visibleDateKeys.reduce((total, currentDateKey) => total + getBillingScheduledHoursForDate(schedule, currentDateKey), 0);
  const rows: BillingCalendarRow[] = [];

  let cumulativeBillableHours = carryInSummary.billableHours;
  let cumulativeTargetBillableHours = 0;
  let cumulativePlannedHours = 0;
  let currentBillableHours = carryInSummary.billableHours;
  let currentPlannedHours = 0;
  let currentTargetBillableHours = 0;
  let totalRawBillableHours = carryInSummary.totalRawHours;
  let finalScheduledDateKey = startDateKey;

  rows.push({
    kind: "carryIn",
    dateKey: carryInStartDateKey,
    label: "Carry-in",
    weekdayKey: null,
    openingBillableHours: 0,
    plannedHours: 0,
    cumulativePlannedHours: 0,
    targetBillableHours: 0,
    rawBillableHours: carryInSummary.totalRawHours,
    billableHours: carryInSummary.billableHours,
    cumulativeBillableHours,
    cumulativeTargetBillableHours,
    billablePercent: null,
    remainingToTargetHours: null,
    isToday: false,
    isFuture: false,
    isOverride: false,
  });

  for (const currentDateKey of visibleDateKeys) {
    const plannedHours = getBillingScheduledHoursForDate(schedule, currentDateKey);
    const targetHours = plannedHours * targetBillableRate;
    const daySummary = getBillableDaySummary(sessions, currentDateKey, plannedHours, targetBillableRate);
    const isFuture = currentDateKey > dateKey;
    const openingBillableHours = cumulativeBillableHours;
    const billableHours = isFuture ? 0 : daySummary.billableHours;
    const rawBillableHours = isFuture ? 0 : daySummary.totalRawHours;
    const isOverride = Object.prototype.hasOwnProperty.call(schedule.dateOverrides, currentDateKey);

    cumulativePlannedHours += plannedHours;
    cumulativeTargetBillableHours += targetHours;

    if (!isFuture) {
      cumulativeBillableHours += billableHours;
      totalRawBillableHours += rawBillableHours;
      currentBillableHours = cumulativeBillableHours;
      currentPlannedHours = cumulativePlannedHours;
      currentTargetBillableHours = cumulativeTargetBillableHours;
    }

    if (plannedHours > 0) {
      finalScheduledDateKey = currentDateKey;
    }

    rows.push({
      kind: "day",
      dateKey: currentDateKey,
      label: getBillingWeekdayLabel(currentDateKey),
      weekdayKey: getBillingWeekdayKey(currentDateKey),
      openingBillableHours,
      plannedHours,
      cumulativePlannedHours,
      targetBillableHours: targetHours,
      rawBillableHours,
      billableHours,
      cumulativeBillableHours,
      cumulativeTargetBillableHours,
      billablePercent: cumulativePlannedHours > 0 ? (cumulativeBillableHours / cumulativePlannedHours) * 100 : null,
      remainingToTargetHours: Math.max(0, cumulativeTargetBillableHours - cumulativeBillableHours),
      isToday: currentDateKey === dateKey,
      isFuture,
      isOverride,
    });
  }

  const tomorrowStartBillableHours = dateKey >= finalScheduledDateKey ? null : cumulativeBillableHours;

  return {
    startDateKey,
    endDateKey,
    carryInStartDateKey,
    carryInEndDateKey,
    finalScheduledDateKey,
    carryInBillableHours: carryInSummary.billableHours,
    carryInRawHours: carryInSummary.totalRawHours,
    rows,
    totalPlannedHours,
    currentPlannedHours,
    totalTargetBillableHours: currentTargetBillableHours,
    totalBillableHours: currentBillableHours,
    totalRawBillableHours,
    remainingToTargetHours: Math.max(0, currentTargetBillableHours - currentBillableHours),
    tomorrowStartBillableHours,
  };
}

export function getBillableWeekTrend(sessions: FocusSession[], weeks = 8, dateKey = getDateKey()) {
  const current = getBillingWeekRange(dateKey).startDateKey;
  return Array.from({ length: weeks }, (_, index) => {
    const startDateKey = shiftDateKey(current, -(weeks - index - 1) * 7);
    const endDateKey = shiftDateKey(startDateKey, 6);
    const summary = getBillableWeekSummary(sessions, endDateKey);

    return {
      startDateKey,
      endDateKey,
      label: `${startDateKey.slice(5)} → ${endDateKey.slice(5)}`,
      billableHours: summary.billableHours,
      billablePercentage: summary.billablePercentage,
      rawBillablePercentage: summary.rawBillablePercentage,
      targetBillableHours: summary.targetBillableHours,
      targetBillablePercentage: 100,
      overTarget: summary.billableHours - summary.targetBillableHours,
    };
  });
}

export function getDailyProductivityTrend(sessions: FocusSession[], days = 14, endDateKey = getDateKey()) {
  return Array.from({ length: days }, (_, index) => {
    const dateKey = shiftDateKey(endDateKey, -(days - index - 1));
    const stats = getDailyProductivity(sessions, dateKey);
    return {
      dateKey,
      label: dateKey.slice(5),
      productivityScore: stats?.productivityScore ?? 0,
      loggedHours: (stats?.workTimeSec ?? 0) / 3600,
      hasSessions: Boolean(stats),
    };
  });
}
