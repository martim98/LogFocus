import { FocusSession, PlanItem, Task, TimerMode } from "@/lib/domain";
import { endOfDayIso, formatMinutes, getDateKey, startOfDayIso } from "@/lib/utils";

export function roundUpToQuarterHour(hours: number) {
  return Math.ceil(hours / 0.25) * 0.25;
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

export function formatHoursDecimal(hours: number) {
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 2)}h`;
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

type BillableEntry = {
  project: string;
  task: string;
  rawHours: number;
};

function getBillableEntries(
  sessions: FocusSession[],
  startIso: string,
  endIso: string,
  activeSession?: {
    projectName: string | null;
    taskName: string | null;
    actualDurationSec: number;
  } | null,
) {
  const daySessions = sessions
    .filter((session) => session.startedAt >= startIso && session.startedAt <= endIso)
    .filter((session) => session.mode === "focus")
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  const grouped = new Map<string, BillableEntry>();

  const addSession = (projectName: string | null, taskName: string | null, actualDurationSec: number) => {
    const project = (projectName ?? "Unassigned").trim();
    if (project.toLowerCase() === "admin") {
      return;
    }

    const task = (taskName ?? "Unassigned").trim();
    const key = `${project}::${task}`;
    const nextHours = actualDurationSec / 3600;
    const existing = grouped.get(key);

    if (existing) {
      existing.rawHours += nextHours;
    } else {
      grouped.set(key, { project, task, rawHours: nextHours });
    }
  };

  for (const session of daySessions) {
    addSession(session.projectName, session.taskName, session.actualDurationSec);
  }

  if (activeSession) {
    addSession(activeSession.projectName, activeSession.taskName, activeSession.actualDurationSec);
  }

  return Array.from(grouped.values())
    .map((entry) => ({
      ...entry,
      roundedHours: roundUpToQuarterHour(entry.rawHours),
    }))
    .sort((a, b) => {
      if (b.roundedHours !== a.roundedHours) return b.roundedHours - a.roundedHours;
      return `${a.project} ${a.task}`.localeCompare(`${b.project} ${b.task}`);
    });
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

export function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getTodayStats(sessions: FocusSession[], tasks: Task[], planItems: PlanItem[], today = getDateKey()) {
  const todaySessions = sessions.filter((session) => session.startedAt >= startOfDayIso(today) && session.startedAt <= endOfDayIso(today));
  const loggedFocus = getLoggedFocusSessions(todaySessions);
  const completedFocus = getCompletedFocusSessions(todaySessions);
  const focusMinutes = Math.round(loggedFocus.reduce((total, session) => total + session.actualDurationSec, 0) / 60);
  const donePlan = planItems.filter((item) => item.status === "done").length;
  const totalPlan = planItems.length;
  const tasksDone = tasks.filter((task) => task.status === "done").length;
  const remainingPomodoros = tasks
    .filter((task) => task.status !== "done")
    .reduce((total, task) => total + task.hours, 0);

  return {
    focusMinutes,
    focusLabel: formatMinutes(focusMinutes),
    completedSessions: completedFocus.length,
    loggedSessions: loggedFocus.length,
    tasksDone,
    totalTasks: tasks.length,
    donePlan,
    totalPlan,
    remainingPomodoros,
  };
}

export function getProjectStats(projectId: string, projectTitle: string, sessions: FocusSession[], tasks: Task[]) {
  const projectLabel = projectTitle.trim().toLowerCase();
  const projectTasks = tasks.filter((task) => {
    if (task.projectId === projectId) {
      return true;
    }
    return task.project.trim().toLowerCase() === projectLabel;
  });
  const projectTaskIds = new Set(projectTasks.map((task) => task.id));
  const projectSessions = sessions.filter((session) => {
    if (session.projectId) {
      return session.projectId === projectId;
    }
    return session.taskId ? projectTaskIds.has(session.taskId) : false;
  });
  const loggedFocus = getLoggedFocusSessions(projectSessions);
  const completedFocus = getCompletedFocusSessions(projectSessions);
  const focusMinutes = Math.round(loggedFocus.reduce((total, session) => total + session.actualDurationSec, 0) / 60);
  const tasksDone = projectTasks.filter((task) => task.status === "done").length;
  const remainingPomodoros = projectTasks
    .filter((task) => task.status !== "done")
    .reduce((total, task) => total + task.hours, 0);

  return {
    focusMinutes,
    focusLabel: formatMinutes(focusMinutes),
    completedSessions: completedFocus.length,
    loggedSessions: loggedFocus.length,
    tasksDone,
    totalTasks: projectTasks.length,
    remainingPomodoros,
  };
}

export function estimateFinishTime(remainingPomodoros: number, focusMinutes: number, shortBreakMinutes: number) {
  if (remainingPomodoros <= 0) {
    return "Clear";
  }

  const totalMinutes = remainingPomodoros * focusMinutes + Math.max(remainingPomodoros - 1, 0) * shortBreakMinutes;
  const finish = new Date(Date.now() + totalMinutes * 60 * 1000);
  return finish.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function getLiveProductivityProjection(sessions: FocusSession[], dateKey = getDateKey()) {
  const now = new Date();
  const startOfDay = new Date(`${dateKey}T00:00:00`);
  const endOfDay = new Date(`${dateKey}T23:59:59.999`);
  const daySessions = sessions
    .filter((session) => session.startedAt >= startOfDayIso(dateKey) && session.startedAt <= endOfDayIso(dateKey))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  const workTimeSec = daySessions
    .filter((session) => session.mode === "focus")
    .reduce((sum, session) => sum + session.actualDurationSec, 0);

  const elapsedSec = Math.max(1, Math.floor((Math.min(now.getTime(), endOfDay.getTime()) - startOfDay.getTime()) / 1000));
  const productiveRate = workTimeSec / elapsedSec;
  const projectedWorkSec = productiveRate * Math.max(0, Math.floor((endOfDay.getTime() - startOfDay.getTime()) / 1000));
  const projectedWorkHours = projectedWorkSec / 3600;
  const currentWorkHours = workTimeSec / 3600;
  const targetWorkHours = 6;
  const remainingToTargetHours = Math.max(0, targetWorkHours - projectedWorkHours);

  return {
    currentWorkHours,
    projectedWorkHours,
    productiveRate,
    targetWorkHours,
    remainingToTargetHours,
  };
}

export function getLiveProductivitySummary(sessions: FocusSession[], dateKey = getDateKey(), targetWorkHours = 6) {
  const now = new Date();
  const daySessions = sessions
    .filter((session) => session.startedAt >= startOfDayIso(dateKey) && session.startedAt <= endOfDayIso(dateKey))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  const focusSeconds = daySessions
    .filter((session) => session.mode === "focus")
    .reduce((sum, session) => sum + session.actualDurationSec, 0);

  const startOfDayMs = new Date(`${dateKey}T00:00:00`).getTime();
  const endOfDayMs = new Date(`${dateKey}T23:59:59.999`).getTime();
  const elapsedSec = Math.max(1, Math.floor((Math.min(now.getTime(), endOfDayMs) - startOfDayMs) / 1000));
  const liveScore = Math.max(0, Math.min(1, focusSeconds / elapsedSec));
  const loggedHours = focusSeconds / 3600;
  const hoursToTarget = Math.max(0, targetWorkHours - loggedHours);
  const hoursNeededAtCurrentPace = liveScore > 0 ? hoursToTarget / liveScore : null;
  const finishAt = hoursNeededAtCurrentPace == null ? null : new Date(now.getTime() + hoursNeededAtCurrentPace * 3600 * 1000);

  return {
    liveScore,
    loggedHours,
    hoursToTarget,
    hoursNeededAtCurrentPace,
    finishAt,
    targetWorkHours,
  };
}

export function getTaskTimeLogged(taskId: string, sessions: FocusSession[]): number {
  const taskSessions = getLoggedFocusSessions(sessions).filter((session) => session.taskId === taskId);
  return Math.round(taskSessions.reduce((total, session) => total + session.actualDurationSec, 0) / 60);
}

export function formatSecondsToHoursMinutes(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function getDailyProductivity(sessions: FocusSession[], dateKey = getDateKey()) {
  const daySessions = sessions
    .filter((s) => s.startedAt >= startOfDayIso(dateKey) && s.startedAt <= endOfDayIso(dateKey))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  if (daySessions.length === 0) return null;

  const firstSession = daySessions[0];
  const lastSession = daySessions[daySessions.length - 1];

  const startTime = new Date(firstSession.startedAt).getTime();
  const isToday = dateKey === getDateKey();
  
  // For today, we measure until 'now'. For past days, until the end of the last session.
  const endTime = isToday ? Date.now() : new Date(lastSession.endedAt).getTime();

  const totalElapsedSec = Math.max(0, Math.floor((endTime - startTime) / 1000));
  const workTimeSec = daySessions
    .filter((s) => s.mode === "focus")
    .reduce((sum, s) => sum + s.actualDurationSec, 0);

  const inefficiencySec = Math.max(0, totalElapsedSec - workTimeSec);
  const productivityScore = totalElapsedSec > 0 ? (workTimeSec / totalElapsedSec) * 100 : 0;

  return {
    startTime: firstSession.startedAt,
    endTime: isToday ? new Date(endTime).toISOString() : lastSession.endedAt,
    totalElapsedSec,
    workTimeSec,
    inefficiencySec,
    productivityScore,
    isToday,
  };
}

export function buildTimeline(sessions: FocusSession[], days: number) {
  const today = new Date();
  const keys = Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - index - 1));
    return getDateKey(date);
  });

  return keys.map((key) => {
    const daySessions = getLoggedFocusSessions(
      sessions.filter((session) => session.startedAt >= startOfDayIso(key) && session.startedAt <= endOfDayIso(key)),
    );

    return {
      date: key.slice(5),
      minutes: Math.round(daySessions.reduce((total, session) => total + session.actualDurationSec, 0) / 60),
      sessions: daySessions.length,
    };
  });
}

export function getBillableDaySummary(
  sessions: FocusSession[],
  dateKey = getDateKey(),
  targetBillableRate = 0.85,
  activeSession?: {
    projectName: string | null;
    taskName: string | null;
    actualDurationSec: number;
  } | null,
) {
  const targetWorkHours = 8;
  const targetBillableHours = targetWorkHours * targetBillableRate;
  const startIso = startOfDayIso(dateKey);
  const endIso = endOfDayIso(dateKey);
  const entries = getBillableEntries(sessions, startIso, endIso, activeSession);

  const billableHours = entries.reduce((total, entry) => total + entry.roundedHours, 0);
  const totalRawHours = entries.reduce((total, entry) => total + entry.rawHours, 0);
  const billableRate = targetWorkHours > 0 ? billableHours / targetWorkHours : 0;
  const distanceToTarget = targetBillableHours - billableHours;

  return {
    dateKey,
    entries,
    billableHours,
    totalRawHours,
    billableRate,
    targetBillableRate,
    targetWorkHours,
    targetBillableHours,
    distanceToTarget,
    isOnTarget: billableHours >= targetBillableHours,
  };
}

export function getBillableWeekSummary(
  sessions: FocusSession[],
  dateKey = getDateKey(),
  activeSession?: {
    projectName: string | null;
    taskName: string | null;
    actualDurationSec: number;
  } | null,
) {
  const { startDateKey, endDateKey } = getBillingWeekRange(dateKey);
  const targetBillableHours = 40;
  const startIso = startOfDayIso(startDateKey);
  const endIso = endOfDayIso(endDateKey);
  const entries = getBillableEntries(sessions, startIso, endIso, activeSession);
  const weekSessions = sessions.filter((session) => session.startedAt >= startIso && session.startedAt <= endIso);
  const billableHours = entries.reduce((total, entry) => total + entry.roundedHours, 0);
  const totalRawHours = entries.reduce((total, entry) => total + entry.rawHours, 0);
  const billablePercentage = targetBillableHours > 0 ? (billableHours / targetBillableHours) * 100 : 0;
  const rawBillablePercentage = targetBillableHours > 0 ? (totalRawHours / targetBillableHours) * 100 : 0;
  const currentDateKey = dateKey < startDateKey ? startDateKey : dateKey > endDateKey ? endDateKey : dateKey;
  const elapsedDays = Math.max(1, Math.floor((Date.parse(endOfDayIso(currentDateKey)) - Date.parse(startIso)) / (24 * 60 * 60 * 1000)) + 1);
  const completedDays = Math.min(7, elapsedDays);
  const currentPaceHoursPerDay = billableHours / completedDays;
  const projectedHours = currentPaceHoursPerDay * 7;
  const remainingHours = Math.max(0, targetBillableHours - billableHours);
  const distanceToTarget = targetBillableHours - billableHours;

  return {
    startDateKey,
    endDateKey,
    entries,
    billableHours,
    totalRawHours,
    targetBillableHours,
    billablePercentage,
    rawBillablePercentage,
    distanceToTarget,
    remainingHours,
    isOnTarget: billableHours >= targetBillableHours,
    currentPaceHoursPerDay,
    projectedHours,
    trendHours: projectedHours - targetBillableHours,
    trendDeltaHours: projectedHours - billableHours,
    daysCovered: completedDays,
    daysRemaining: Math.max(0, 7 - completedDays),
    weekSessions,
  };
}

export function getBillableWeekTrend(
  sessions: FocusSession[],
  weeks: number = 8,
  dateKey = getDateKey(),
) {
  const current = getBillingWeekRange(dateKey).startDateKey;
  return Array.from({ length: weeks }, (_, index) => {
    const startDateKey = shiftDateKey(current, -(weeks - index - 1) * 7);
    const endDateKey = shiftDateKey(startDateKey, 6);
    const summary = getBillableWeekSummary(
      sessions,
      endDateKey,
    );

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
