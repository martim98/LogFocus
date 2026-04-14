import { FocusSession, PlanItem, Task } from "@/lib/domain";
import { endOfDayIso, formatMinutes, getDateKey, startOfDayIso } from "@/lib/utils";

export function getFocusSessions(sessions: FocusSession[]) {
  return sessions.filter((session) => session.mode === "focus");
}

export function getLoggedFocusSessions(sessions: FocusSession[]) {
  return getFocusSessions(sessions);
}

export function getCompletedFocusSessions(sessions: FocusSession[]) {
  return getFocusSessions(sessions).filter((session) => session.completed);
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
    .reduce((total, task) => total + Math.max(task.estimatePomodoros - task.completedPomodoros, 0), 0);

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

export function getProjectStats(projectId: string, sessions: FocusSession[], tasks: Task[]) {
  const projectTasks = tasks.filter((task) => task.projectId === projectId);
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
    .reduce((total, task) => total + Math.max(task.estimatePomodoros - task.completedPomodoros, 0), 0);

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
