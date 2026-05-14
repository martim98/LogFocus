import { billingWeekdayOrder, defaultSettings } from "@/lib/domain";
import type { BillingSchedule, BillingWeekdayKey, FocusSession, PlanItem, Project, Task, TimerMode, TimerSettings, TodoItem } from "@/lib/domain";
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
  projectId?: string | null;
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

export type SessionAnalyticsIndex = {
  sessions: FocusSession[];
  focusSessions: FocusSession[];
  focusSessionsAsc: FocusSession[];
  focusSessionsDesc: FocusSession[];
  sessionsByDate: Map<string, FocusSession[]>;
  focusSessionsByDate: Map<string, FocusSession[]>;
  focusSecondsByTaskId: Map<string, number>;
  focusSecondsByTodoItemId: Map<string, number>;
  focusSecondsByTodoItemDate: Map<string, Map<string, number>>;
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

export type LiveBannerPaceSummary = {
  dateKey: string;
  weekStartDateKey: string;
  weekEndDateKey: string;
  weeklyPlannedHours: number;
  weeklyRoundedBillableTargetHours: number;
  roundedBillableLoggedBeforeTodayHours: number;
  remainingRoundedBillableWeekHours: number;
  remainingScheduledWorkdays: number;
  roundedBillableNeededTodayHours: number | null;
  todayRoundedBillableHours: number;
  rawFocusTargetTodayHours: number | null;
  todayLoggedRawFocusHours: number;
  rawFocusRemainingTodayHours: number | null;
  liveProductivityScore: number;
  finishAt: Date | null;
};

export type LiveBannerAlertEvent =
  | "focus75"
  | "rawFocusDone"
  | "billableDone"
  | "finishSlip"
  | "idle"
  | "breakRecommended";

export type LiveBannerAlertMemory = {
  dateKey: string;
  firedEvents: LiveBannerAlertEvent[];
  earliestFinishAtMs: number | null;
  idleStartedAtMs: number | null;
};

export type LiveBannerAlertSettings = Pick<
  TimerSettings,
  | "alertFocus75Enabled"
  | "alertRawFocusDoneEnabled"
  | "alertBillableNeedDoneEnabled"
  | "alertFinishBySlippingEnabled"
  | "alertIdleWhileWorkRemainsEnabled"
  | "alertBillableAheadBreakEnabled"
>;

export type LiveBannerAlertEvaluation = {
  events: LiveBannerAlertEvent[];
  memory: LiveBannerAlertMemory;
  breakSignal: {
    active: boolean;
    gapHours: number;
    label: "Balanced" | "Break recommended";
    helper: string | null;
  };
};

export type DayCoachState = "work" | "break" | "resume" | "done" | "catch-up";

export type DayCoachCueEvent = "coachWork" | "coachBreak" | "coachResume" | "coachDone" | "coachCatchUp";

export type DayCoachUpdate = {
  id: string;
  dateKey: string;
  at: string;
  state: DayCoachState;
  label: string;
  message: string;
};

export type DayCoachMemory = {
  dateKey: string;
  lastCueByState: Partial<Record<DayCoachState, number>>;
  breakUntilMs: number | null;
  updates: DayCoachUpdate[];
  muted: boolean;
};

export type DayCoachEvaluation = {
  state: DayCoachState;
  title: string;
  message: string;
  helper: string;
  severity: "neutral" | "success" | "warning";
  nextCueAt: Date | null;
  cueEvent: DayCoachCueEvent | null;
  spokenMessage: string | null;
  memory: DayCoachMemory;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

const DAY_COACH_COOLDOWN_MS = 20 * 60 * 1000;
const DAY_COACH_BREAK_AHEAD_THRESHOLD_HOURS = 0.25;

const analyticsIndexCache = new WeakMap<FocusSession[], SessionAnalyticsIndex>();

export function createSessionAnalyticsIndex(sessions: FocusSession[]): SessionAnalyticsIndex {
  const focusSessions: FocusSession[] = [];
  const sessionsByDate = new Map<string, FocusSession[]>();
  const focusSessionsByDate = new Map<string, FocusSession[]>();
  const focusSecondsByTaskId = new Map<string, number>();
  const focusSecondsByTodoItemId = new Map<string, number>();
  const focusSecondsByTodoItemDate = new Map<string, Map<string, number>>();

  for (const session of sessions) {
    const dateKey = getDateKey(new Date(session.startedAt));
    const daySessions = sessionsByDate.get(dateKey);
    if (daySessions) {
      daySessions.push(session);
    } else {
      sessionsByDate.set(dateKey, [session]);
    }

    if (session.mode !== "focus") {
      continue;
    }

    focusSessions.push(session);
    const dayFocusSessions = focusSessionsByDate.get(dateKey);
    if (dayFocusSessions) {
      dayFocusSessions.push(session);
    } else {
      focusSessionsByDate.set(dateKey, [session]);
    }

    if (session.taskId) {
      focusSecondsByTaskId.set(session.taskId, (focusSecondsByTaskId.get(session.taskId) ?? 0) + session.actualDurationSec);
    }

    if (session.todoItemId) {
      focusSecondsByTodoItemId.set(session.todoItemId, (focusSecondsByTodoItemId.get(session.todoItemId) ?? 0) + session.actualDurationSec);
      const dayTodoSeconds = focusSecondsByTodoItemDate.get(dateKey) ?? new Map<string, number>();
      dayTodoSeconds.set(session.todoItemId, (dayTodoSeconds.get(session.todoItemId) ?? 0) + session.actualDurationSec);
      focusSecondsByTodoItemDate.set(dateKey, dayTodoSeconds);
    }
  }

  return {
    sessions,
    focusSessions,
    focusSessionsAsc: focusSessions.slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    focusSessionsDesc: focusSessions.slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    sessionsByDate,
    focusSessionsByDate,
    focusSecondsByTaskId,
    focusSecondsByTodoItemId,
    focusSecondsByTodoItemDate,
  };
}

function getSessionAnalyticsIndex(sessions: FocusSession[]) {
  const cached = analyticsIndexCache.get(sessions);
  if (cached) {
    return cached;
  }

  const index = createSessionAnalyticsIndex(sessions);
  analyticsIndexCache.set(sessions, index);
  return index;
}

function getIndexedDaySessions(index: SessionAnalyticsIndex, dateKey: string) {
  return index.sessionsByDate.get(dateKey) ?? [];
}

function getIndexedDayFocusSessions(index: SessionAnalyticsIndex, dateKey: string) {
  return index.focusSessionsByDate.get(dateKey) ?? [];
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

export type SuggestedBillableWeekTarget = {
  suggestedHours: number;
  baselineTargetHours: number;
  historicalAverageHours: number | null;
  deltaHours: number;
  suggestedRate: number;
  baselineTargetRate: number;
  historicalAverageRate: number | null;
  deltaRate: number;
  direction: "rest" | "catch-up" | "baseline";
  weeksUsed: number;
  reason: string;
};

export type DailyBillableRollingAveragePoint = {
  dateKey: string;
  label: string;
  billableHours: number;
  plannedHours: number;
  billablePercentage: number | null;
  rollingAveragePercentage: number | null;
  hasLoggedWeekdayWork: boolean;
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
  return getBillingWeekRange(dateKey);
}

function getBillingCalendarVisibleDateKeys(dateKey = getDateKey()) {
  const { startDateKey, endDateKey } = getBillingCalendarWeekRange(dateKey);
  return getDateKeysInRange(startDateKey, endDateKey);
}

export function getTypicalBillingDayHours(schedule: BillingSchedule) {
  const positiveHours = billingWeekdayOrder
    .map((weekday) => schedule.weekdayHours[weekday.key])
    .filter((hours) => hours > 0);

  if (positiveHours.length === 0) {
    return defaultSettings.billingWorkHoursPerDay;
  }

  return positiveHours.reduce((total, hours) => total + hours, 0) / positiveHours.length;
}

export function getBillingScheduleWeeklyHours(schedule: BillingSchedule) {
  return billingWeekdayOrder.reduce((total, weekday) => total + schedule.weekdayHours[weekday.key], 0);
}

export function getBillingScheduleWorkdayCount(schedule: BillingSchedule) {
  return billingWeekdayOrder.filter((weekday) => schedule.weekdayHours[weekday.key] > 0).length;
}

export function getBillableAdjustedTargetHours(plannedHours: number, settings: TimerSettings) {
  return plannedHours * settings.billableTargetRate * settings.rewardTargetRate;
}

export function formatHoursDecimal(hours: number) {
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 2)}h`;
}

export function formatHoursOneDecimal(value: number) {
  return `${value.toFixed(1)}h`;
}

export function getBillableAdjustedDailyTargetHours(settings: TimerSettings) {
  return getBillableAdjustedTargetHours(getTypicalBillingDayHours(settings.billingSchedule), settings);
}

export function getBillableAdjustedWeeklyTargetHours(settings: TimerSettings) {
  return getBillableAdjustedTargetHours(getBillingScheduleWeeklyHours(settings.billingSchedule), settings);
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
  return getIndexedDaySessions(getSessionAnalyticsIndex(sessions), dateKey).slice();
}

export function getFocusSessions(sessions: FocusSession[]) {
  return getSessionAnalyticsIndex(sessions).focusSessions.slice();
}

export function getLoggedFocusSessions(sessions: FocusSession[]) {
  return getFocusSessions(sessions);
}

export function getCompletedFocusSessions(sessions: FocusSession[]) {
  return getFocusSessions(sessions).filter((session) => session.completed);
}

export function getDayFocusSessions(sessions: FocusSession[], dateKey = getDateKey()) {
  return getIndexedDayFocusSessions(getSessionAnalyticsIndex(sessions), dateKey).slice();
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

function getBillableDaySummariesInTimeRange(
  sessions: FocusSession[],
  startIso: string,
  endIso: string,
  projects: Array<Pick<Project, "id" | "title">> = [],
) {
  const grouped = new Map<string, BillableSource[]>();
  const orderedSessions = getSessionAnalyticsIndex(sessions).focusSessionsAsc.filter((session) => session.startedAt >= startIso && session.startedAt <= endIso);

  for (const session of orderedSessions) {
    const dateKey = getDateKey(new Date(session.startedAt));
    const bucket = grouped.get(dateKey);
    const source: BillableSource = {
      projectId: session.projectId,
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
      ...summarizeBillableEntries(buildBillableEntries(sources, projects)),
    }));
}

export function getWorkweekLoggedHours(sessions: FocusSession[], dateKey = getDateKey()) {
  const { carryInStartDateKey, endDateKey } = getWorkweekDateRange(dateKey);
  const startIso = startOfDayIso(carryInStartDateKey);
  const endIso = endOfDayIso(endDateKey);
  return sumActualDurationSec(getSessionAnalyticsIndex(sessions).focusSessions.filter((session) => session.startedAt >= startIso && session.startedAt <= endIso)) / 3600;
}

export function getVisibleWeekLoggedHours(sessions: FocusSession[], dateKey = getDateKey()) {
  const { startDateKey, endDateKey } = getBillingWeekRange(dateKey);
  const currentEndDateKey = dateKey < startDateKey ? startDateKey : dateKey > endDateKey ? endDateKey : dateKey;
  const startIso = startOfDayIso(startDateKey);
  const endIso = endOfDayIso(currentEndDateKey);
  return sumActualDurationSec(getSessionAnalyticsIndex(sessions).focusSessions.filter((session) => session.startedAt >= startIso && session.startedAt <= endIso)) / 3600;
}

export function getLiveBannerPaceSummary(
  sessions: FocusSession[],
  dateKey = getDateKey(),
  schedule: BillingSchedule = defaultSettings.billingSchedule,
  targetBillableRate = defaultSettings.billableTargetRate,
  rawToRoundedBillableRate = defaultSettings.rewardTargetRate,
  now = new Date(),
  projects: Array<Pick<Project, "id" | "title">> = [],
): LiveBannerPaceSummary {
  const { startDateKey, endDateKey } = getBillingWeekRange(dateKey);
  const weekDateKeys = getDateKeysInRange(startDateKey, endDateKey);
  const weeklyPlannedHours = weekDateKeys.reduce((total, currentDateKey) => total + getBillingScheduledHoursForDate(schedule, currentDateKey), 0);
  const weeklyRoundedBillableTargetHours = weeklyPlannedHours * targetBillableRate;
  const priorEndDateKey = shiftDateKey(dateKey, -1);
  const priorDaySummaries =
    priorEndDateKey >= startDateKey ? getBillableDaySummariesInRange(sessions, startDateKey, priorEndDateKey, projects) : [];
  const roundedBillableLoggedBeforeTodayHours = mergeBillableDaySummaries(priorDaySummaries).billableHours;
  const remainingRoundedBillableWeekHours = Math.max(0, weeklyRoundedBillableTargetHours - roundedBillableLoggedBeforeTodayHours);
  const remainingScheduledWorkdays = weekDateKeys.filter((currentDateKey) =>
    currentDateKey >= dateKey && getBillingScheduledHoursForDate(schedule, currentDateKey) > 0
  ).length;
  const roundedBillableNeededTodayHours =
    remainingScheduledWorkdays > 0 ? remainingRoundedBillableWeekHours / remainingScheduledWorkdays : null;
  const todayRoundedBillableHours = getBillableDaySummary(sessions, dateKey, undefined, undefined, projects).billableHours;
  const boundedRawToRoundedBillableRate = Math.max(0, rawToRoundedBillableRate);
  const rawFocusTargetTodayHours =
    roundedBillableNeededTodayHours == null ? null : roundedBillableNeededTodayHours * boundedRawToRoundedBillableRate;
  const index = getSessionAnalyticsIndex(sessions);
  const daySessions = getIndexedDaySessions(index, dateKey).slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const focusTimeSec = sumActualDurationSec(getIndexedDayFocusSessions(index, dateKey));
  const firstSession = daySessions[0] ?? null;
  const lastSession = daySessions[daySessions.length - 1] ?? null;
  const isToday = dateKey === getDateKey(now);
  const productivityEndTime = isToday ? now.getTime() : lastSession ? new Date(lastSession.endedAt).getTime() : now.getTime();
  const productivityElapsedSec = firstSession
    ? Math.max(0, Math.floor((productivityEndTime - new Date(firstSession.startedAt).getTime()) / 1000))
    : 0;
  const todayLoggedRawFocusHours = focusTimeSec / 3600;
  const rawFocusRemainingTodayHours =
    rawFocusTargetTodayHours == null ? null : Math.max(0, rawFocusTargetTodayHours - todayLoggedRawFocusHours);
  const liveProductivityScore = productivityElapsedSec > 0 ? (focusTimeSec / productivityElapsedSec) * 100 : 0;
  const liveProductivityRate = liveProductivityScore / 100;
  const finishAt =
    rawFocusRemainingTodayHours == null || rawFocusRemainingTodayHours === 0 || liveProductivityRate <= 0
      ? null
      : new Date(now.getTime() + (rawFocusRemainingTodayHours / liveProductivityRate) * 3600 * 1000);

  return {
    dateKey,
    weekStartDateKey: startDateKey,
    weekEndDateKey: endDateKey,
    weeklyPlannedHours,
    weeklyRoundedBillableTargetHours,
    roundedBillableLoggedBeforeTodayHours,
    remainingRoundedBillableWeekHours,
    remainingScheduledWorkdays,
    roundedBillableNeededTodayHours,
    todayRoundedBillableHours,
    rawFocusTargetTodayHours,
    todayLoggedRawFocusHours,
    rawFocusRemainingTodayHours,
    liveProductivityScore,
    finishAt,
  };
}

export function createLiveBannerAlertMemory(dateKey = getDateKey()): LiveBannerAlertMemory {
  return {
    dateKey,
    firedEvents: [],
    earliestFinishAtMs: null,
    idleStartedAtMs: null,
  };
}

export function evaluateLiveBannerAlerts(params: {
  pace: LiveBannerPaceSummary;
  settings: LiveBannerAlertSettings;
  memory: LiveBannerAlertMemory | null;
  timerIsRunning: boolean;
  now: Date;
}): LiveBannerAlertEvaluation {
  const { pace, settings, timerIsRunning, now } = params;
  const currentMemory =
    params.memory?.dateKey === pace.dateKey ? params.memory : createLiveBannerAlertMemory(pace.dateKey);
  const fired = new Set(currentMemory.firedEvents);
  const nextEvents: LiveBannerAlertEvent[] = [];
  const nowMs = now.getTime();
  const finishAtMs = pace.finishAt?.getTime() ?? null;
  const earliestFinishAtMs =
    finishAtMs == null
      ? currentMemory.earliestFinishAtMs
      : currentMemory.earliestFinishAtMs == null
        ? finishAtMs
        : Math.min(currentMemory.earliestFinishAtMs, finishAtMs);
  const hasRawTarget = pace.rawFocusTargetTodayHours != null && pace.rawFocusTargetTodayHours > 0;
  const rawProgress = hasRawTarget ? pace.todayLoggedRawFocusHours / pace.rawFocusTargetTodayHours! : 0;
  const billableProgress =
    pace.roundedBillableNeededTodayHours != null && pace.roundedBillableNeededTodayHours > 0
      ? pace.todayRoundedBillableHours / pace.roundedBillableNeededTodayHours
      : 0;
  const billableAheadGapHours = Math.max(0, pace.todayRoundedBillableHours - pace.todayLoggedRawFocusHours);
  const isBillableAhead = billableAheadGapHours >= 0.25;
  const idleStartedAtMs =
    !timerIsRunning && pace.rawFocusRemainingTodayHours != null && pace.rawFocusRemainingTodayHours > 0
      ? currentMemory.idleStartedAtMs ?? nowMs
      : null;

  function addEvent(enabled: boolean, event: LiveBannerAlertEvent, condition: boolean) {
    if (enabled && condition && !fired.has(event)) {
      nextEvents.push(event);
      fired.add(event);
    }
  }

  addEvent(settings.alertFocus75Enabled, "focus75", rawProgress >= 0.75);
  addEvent(settings.alertRawFocusDoneEnabled, "rawFocusDone", hasRawTarget && pace.rawFocusRemainingTodayHours === 0);
  addEvent(settings.alertBillableNeedDoneEnabled, "billableDone", billableProgress >= 1);
  addEvent(
    settings.alertFinishBySlippingEnabled,
    "finishSlip",
    finishAtMs != null &&
      (isAfterFinishCutoff(finishAtMs) ||
        (earliestFinishAtMs != null && finishAtMs - earliestFinishAtMs >= 30 * 60 * 1000)),
  );
  addEvent(
    settings.alertIdleWhileWorkRemainsEnabled,
    "idle",
    idleStartedAtMs != null && nowMs - idleStartedAtMs >= 15 * 60 * 1000,
  );
  addEvent(settings.alertBillableAheadBreakEnabled, "breakRecommended", isBillableAhead);

  return {
    events: nextEvents,
    memory: {
      dateKey: pace.dateKey,
      firedEvents: Array.from(fired),
      earliestFinishAtMs,
      idleStartedAtMs,
    },
    breakSignal: {
      active: isBillableAhead,
      gapHours: billableAheadGapHours,
      label: isBillableAhead ? "Break recommended" : "Balanced",
      helper: isBillableAhead ? `${formatHoursOneDecimal(billableAheadGapHours)} billable ahead of raw focus` : null,
    },
  };
}

export function createDayCoachMemory(dateKey = getDateKey(), muted = false): DayCoachMemory {
  return {
    dateKey,
    lastCueByState: {},
    breakUntilMs: null,
    updates: [],
    muted,
  };
}

export function evaluateDayCoach(params: {
  pace: LiveBannerPaceSummary;
  billingCalendarSummary: BillingCalendarSummary;
  timerIsRunning: boolean;
  now: Date;
  productivityTargetRate?: number;
  memory: DayCoachMemory | null;
}): DayCoachEvaluation {
  const { pace, billingCalendarSummary, timerIsRunning, now } = params;
  const nowMs = now.getTime();
  const memory = params.memory?.dateKey === pace.dateKey ? params.memory : createDayCoachMemory(pace.dateKey);
  const rawRemaining = pace.rawFocusRemainingTodayHours ?? 0;
  const rawTarget = pace.rawFocusTargetTodayHours ?? 0;
  const billableAheadGapHours = Math.max(0, pace.todayRoundedBillableHours - pace.todayLoggedRawFocusHours);
  const isBillableAhead = billableAheadGapHours >= DAY_COACH_BREAK_AHEAD_THRESHOLD_HOURS;
  const productivityTargetPercent = Math.max(0, params.productivityTargetRate ?? defaultSettings.rewardTargetRate) * 100;
  const finishIsSlipping = pace.finishAt != null && isAfterFinishCutoff(pace.finishAt.getTime());
  const todayRow = billingCalendarSummary.rows.find((row) => row.dateKey === pace.dateKey);
  const isBehindBillingPace = (todayRow?.remainingToTargetHours ?? 0) > 0.01;

  let state: DayCoachState = "work";
  let title = "Work";
  let message = rawRemaining > 0 ? `Keep working · ${formatHoursOneDecimal(rawRemaining)} focus left` : "Keep steady";
  let helper = "Finish-by is on track";
  let severity: DayCoachEvaluation["severity"] = "neutral";
  let nextCueAt: Date | null = null;
  let breakUntilMs = memory.breakUntilMs;

  if (isBillableAhead) {
    const breakMinutes = Math.min(20, Math.max(5, Math.round(billableAheadGapHours * 60)));
    state = "break";
    title = "Break";
    message = `Take a ${breakMinutes} min break`;
    helper = `${formatHoursOneDecimal(billableAheadGapHours)} billable ahead of raw focus`;
    severity = "warning";
    nextCueAt = new Date(nowMs + breakMinutes * 60 * 1000);
    breakUntilMs = memory.breakUntilMs != null && memory.breakUntilMs > nowMs ? memory.breakUntilMs : nextCueAt.getTime();
  } else if (rawTarget > 0 && rawRemaining === 0) {
    state = "done";
    title = "Done";
    message = "Done for today";
    helper = "Weekly target is on track for today";
    severity = "success";
    breakUntilMs = null;
  } else if (!timerIsRunning && rawRemaining > 0 && (finishIsSlipping || pace.liveProductivityScore < productivityTargetPercent)) {
    state = "resume";
    title = "Resume";
    message = "Resume work";
    helper = finishIsSlipping ? "Finish-by is slipping" : `Live score is below ${productivityTargetPercent.toFixed(0)}%`;
    severity = "warning";
    breakUntilMs = null;
  } else if (rawRemaining > 0 && (finishIsSlipping || isBehindBillingPace)) {
    state = "catch-up";
    title = "Catch up";
    message = `Catch up · ${formatHoursOneDecimal(rawRemaining)} raw focus needed today`;
    helper = finishIsSlipping ? "Finish-by is past 18:00" : "Rounded billable is behind today's pace";
    severity = "warning";
    breakUntilMs = null;
  } else if (rawRemaining > 0) {
    state = "work";
    title = "Work";
    message = timerIsRunning ? `Keep working · ${formatHoursOneDecimal(rawRemaining)} focus left` : `Work when ready · ${formatHoursOneDecimal(rawRemaining)} focus left`;
    helper = pace.finishAt ? "Finish-by is on track" : "No live pace yet";
    breakUntilMs = null;
  }

  const cueEvent = getDayCoachCueEvent(state);
  const lastCueAtMs = memory.lastCueByState[state] ?? null;
  const inCooldown = lastCueAtMs != null && nowMs - lastCueAtMs < DAY_COACH_COOLDOWN_MS;
  const stillInBreakWindow = state === "break" && memory.breakUntilMs != null && nowMs < memory.breakUntilMs;
  const shouldCue = !memory.muted && !inCooldown && !stillInBreakWindow;
  const nextLastCueByState = shouldCue ? { ...memory.lastCueByState, [state]: nowMs } : { ...memory.lastCueByState };
  const update = shouldCue
    ? {
        id: `${pace.dateKey}-${nowMs}-${state}`,
        dateKey: pace.dateKey,
        at: now.toISOString(),
        state,
        label: title,
        message,
      }
    : null;

  return {
    state,
    title,
    message,
    helper,
    severity,
    nextCueAt,
    cueEvent: shouldCue ? cueEvent : null,
    spokenMessage: shouldCue ? `${title}. ${message.replace(" · ", ". ")}. ${helper}.` : null,
    memory: {
      dateKey: pace.dateKey,
      lastCueByState: nextLastCueByState,
      breakUntilMs,
      updates: update ? [update, ...memory.updates.filter((item) => item.dateKey === pace.dateKey)].slice(0, 5) : memory.updates.filter((item) => item.dateKey === pace.dateKey),
      muted: memory.muted,
    },
  };
}

function getDayCoachCueEvent(state: DayCoachState): DayCoachCueEvent {
  switch (state) {
    case "break":
      return "coachBreak";
    case "resume":
      return "coachResume";
    case "done":
      return "coachDone";
    case "catch-up":
      return "coachCatchUp";
    case "work":
      return "coachWork";
  }
}

function isAfterFinishCutoff(finishAtMs: number) {
  const finishAt = new Date(finishAtMs);
  return finishAt.getHours() > 18 || (finishAt.getHours() === 18 && finishAt.getMinutes() > 0);
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

function buildProjectTitleById(projects: Array<Pick<Project, "id" | "title">> = []) {
  return new Map(projects.map((project) => [project.id, project.title]));
}

function resolveBillableProjectName(source: BillableSource, projectTitleById: Map<string, string>) {
  return source.projectName ?? (source.projectId ? projectTitleById.get(source.projectId) ?? null : null);
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
  const focusSessions = getIndexedDayFocusSessions(getSessionAnalyticsIndex(sessions), dateKey)
    .slice()
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
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

function buildBillableEntries(sources: BillableSource[], projects: Array<Pick<Project, "id" | "title">> = []) {
  const grouped = new Map<string, BillableEntry>();
  const projectTitleById = buildProjectTitleById(projects);

  for (const source of sources) {
    const bucket = normalizeBillableBucket(resolveBillableProjectName(source, projectTitleById), source.taskName);
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

function getBillableDayEntries(sessions: FocusSession[], dateKey: string, projects: Array<Pick<Project, "id" | "title">> = []) {
  return buildBillableEntries(
    getIndexedDayFocusSessions(getSessionAnalyticsIndex(sessions), dateKey)
      .slice()
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .map((session) => ({
        projectId: session.projectId,
        projectName: session.projectName,
        taskName: session.taskName,
        actualDurationSec: session.actualDurationSec,
      })),
    projects,
  );
}

function getBillableDaySummariesInRange(
  sessions: FocusSession[],
  startDateKey: string,
  endDateKey: string,
  projects: Array<Pick<Project, "id" | "title">> = [],
) {
  return getDateKeysInRange(startDateKey, endDateKey).map((dateKey) => getBillableDaySummary(sessions, dateKey, undefined, undefined, projects));
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

export type ProjectWeeklyStatsRow = {
  projectId: string;
  projectTitle: string;
  totalMinutes: number;
  weeksActive: number;
  meanMinutesPerWeek: number;
  medianMinutesPerWeek: number;
  peakMinutesPerWeek: number;
};

function getWeekStartDateKey(dateKey: string) {
  const midpoint = new Date(`${dateKey}T12:00:00Z`);
  const daysSinceMonday = (midpoint.getUTCDay() + 6) % 7;
  return shiftDateKey(dateKey, -daysSinceMonday);
}

function getMedian(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function getTopProjectWeeklyStats(projects: Array<{ id: string; title: string }>, sessions: FocusSession[], limit = 10): ProjectWeeklyStatsRow[] {
  const rows = projects
    .map((project) => {
      const weekTotals = new Map<string, number>();
      const projectSessions = getLoggedFocusSessions(resolveProjectSessions(project.id, project.title, sessions, []));

      for (const session of projectSessions) {
        const dateKey = getDateKey(new Date(session.startedAt));
        const weekStartDateKey = getWeekStartDateKey(dateKey);
        weekTotals.set(weekStartDateKey, (weekTotals.get(weekStartDateKey) ?? 0) + session.actualDurationSec / 60);
      }

      const weeklyMinutes = Array.from(weekTotals.values());
      const totalMinutes = weeklyMinutes.reduce((sum, value) => sum + value, 0);

      return {
        projectId: project.id,
        projectTitle: project.title,
        totalMinutes,
        weeksActive: weeklyMinutes.length,
        meanMinutesPerWeek: weeklyMinutes.length > 0 ? totalMinutes / weeklyMinutes.length : 0,
        medianMinutesPerWeek: getMedian(weeklyMinutes),
        peakMinutesPerWeek: weeklyMinutes.length > 0 ? Math.max(...weeklyMinutes) : 0,
      };
    })
    .filter((row) => row.totalMinutes > 0)
    .sort((a, b) => {
      if (b.totalMinutes !== a.totalMinutes) return b.totalMinutes - a.totalMinutes;
      return a.projectTitle.localeCompare(b.projectTitle);
    });

  return rows.slice(0, limit);
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
  return Math.round((getSessionAnalyticsIndex(sessions).focusSecondsByTaskId.get(taskId) ?? 0) / 60);
}

export function getTodoItemTimeLogged(todoItemId: string, sessions: FocusSession[]) {
  return Math.round((getSessionAnalyticsIndex(sessions).focusSecondsByTodoItemId.get(todoItemId) ?? 0) / 60);
}

export function getTodoItemTimeLoggedToday(todoItemId: string, sessions: FocusSession[], dateKey = getDateKey()) {
  return Math.round((getSessionAnalyticsIndex(sessions).focusSecondsByTodoItemDate.get(dateKey)?.get(todoItemId) ?? 0) / 60);
}

export function getRecentTodoSuggestions(
  todoItems: TodoItem[],
  sessions: FocusSession[],
  limit = 5,
) {
  const todoById = new Map(todoItems.map((item) => [item.id, item]));
  const suggestions = new Map<string, { todoItemId: string; title: string; project: string; projectId: string | null; lastUsedAt: string }>();
  const sortedSessions = getSessionAnalyticsIndex(sessions).focusSessionsDesc;

  for (const session of sortedSessions) {
    if (!session.todoItemId) continue;
    const item = todoById.get(session.todoItemId);
    if (!item || item.completed) continue;
    if (!suggestions.has(item.id)) {
      suggestions.set(item.id, {
        todoItemId: item.id,
        title: item.title,
        project: item.project,
        projectId: item.projectId,
        lastUsedAt: session.startedAt,
      });
    }
    if (suggestions.size >= limit) break;
  }

  if (suggestions.size < limit) {
    for (const item of todoItems.filter((entry) => !entry.completed)) {
      if (suggestions.has(item.id)) continue;
      suggestions.set(item.id, {
        todoItemId: item.id,
        title: item.title,
        project: item.project,
        projectId: item.projectId,
        lastUsedAt: item.updatedAt,
      });
      if (suggestions.size >= limit) break;
    }
  }

  return Array.from(suggestions.values()).slice(0, limit);
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
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const recentSuggestions = new Map<string, RecentTaskSuggestion>();
  const sortedSessions = getSessionAnalyticsIndex(sessions).focusSessionsDesc;

  for (const session of sortedSessions) {
    const sessionProjectMatches =
      (projectId && session.projectId === projectId) ||
      normalizeText(session.projectName) === projectLabel ||
      (session.taskId ? projectTaskIds.has(session.taskId) : false);

    if (!sessionProjectMatches) continue;

    const task = session.taskId ? taskById.get(session.taskId) ?? null : null;
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
  const index = getSessionAnalyticsIndex(sessions);
  const daySessions = getIndexedDaySessions(index, dateKey).slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  if (daySessions.length === 0) return null;

  const firstSession = daySessions[0];
  const lastSession = daySessions[daySessions.length - 1];
  const startTime = new Date(firstSession.startedAt).getTime();
  const isToday = dateKey === getDateKey();
  const endTime = isToday ? Date.now() : new Date(lastSession.endedAt).getTime();
  const totalElapsedSec = Math.max(0, Math.floor((endTime - startTime) / 1000));
  const workTimeSec = sumActualDurationSec(getIndexedDayFocusSessions(index, dateKey));
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
  const sessionIndex = getSessionAnalyticsIndex(sessions);
  return Array.from({ length: days }, (_, offset) => {
    const dateKey = shiftDateKey(todayKey, -(days - offset - 1));
    const daySessions = getIndexedDayFocusSessions(sessionIndex, dateKey);
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
  projects: Array<Pick<Project, "id" | "title">> = [],
) {
  const entries = getBillableDayEntries(sessions, dateKey, projects);
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
  projects: Array<Pick<Project, "id" | "title">> = [],
) {
  const { startDateKey, endDateKey } = getBillingWeekRange(dateKey);
  const daySummaries = getBillableDaySummariesInRange(sessions, startDateKey, endDateKey, projects);
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
  projects: Array<Pick<Project, "id" | "title">> = [],
) {
  const { startDateKey, endDateKey } = getBillingWeekRange(dateKey);
  const targetBillableHours = targetWorkHours * targetBillableRate;
  const priorDaySummaries = getBillableDaySummariesInRange(sessions, startDateKey, shiftDateKey(dateKey, -1), projects);
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
  projects: Array<Pick<Project, "id" | "title">> = [],
) {
  const { carryInStartDateKey: startDateKey, endDateKey } = getWorkweekDateRange(dateKey);
  const daySummaries = getBillableDaySummariesInRange(sessions, startDateKey, endDateKey, projects);
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
  projects: Array<Pick<Project, "id" | "title">> = [],
): BillableProgressToNow {
  const periodEnd = getBillingWeekCutoff(now, weekEndDay, weekEndTime);
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - 7);
  periodStart.setHours(periodStart.getHours(), periodStart.getMinutes(), 0, 0);

  const actualSessions = getSessionsInRange(sessions, periodStart.toISOString(), now.toISOString()).slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const daySummaries = getBillableDaySummariesInTimeRange(sessions, periodStart.toISOString(), now.toISOString(), projects);
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
  projects: Array<Pick<Project, "id" | "title">> = [],
): BillingCalendarSummary {
  const { startDateKey, endDateKey } = getBillingCalendarWeekRange(dateKey);
  const carryInStartDateKey = startDateKey;
  const carryInEndDateKey = startDateKey;
  const carryInSummary = {
    entries: [] as BillableEntry[],
    billableHours: 0,
    totalRawHours: 0,
  };
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

  for (const currentDateKey of visibleDateKeys) {
    const plannedHours = getBillingScheduledHoursForDate(schedule, currentDateKey);
    const targetHours = plannedHours * targetBillableRate;
    const daySummary = getBillableDaySummary(sessions, currentDateKey, plannedHours, targetBillableRate, projects);
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

export function getDailyBillableRollingAverage(
  sessions: FocusSession[],
  dateKey = getDateKey(),
  schedule: BillingSchedule = defaultSettings.billingSchedule,
  days = 45,
  rollingWindow = 5,
  projects: Array<Pick<Project, "id" | "title">> = [],
): DailyBillableRollingAveragePoint[] {
  const startDateKey = shiftDateKey(dateKey, -(days - 1));
  const validPercentages: number[] = [];

  return getDateKeysInRange(startDateKey, dateKey).map((currentDateKey) => {
    const weekdayKey = getBillingWeekdayKey(currentDateKey);
    const isWeekend = weekdayKey === "saturday" || weekdayKey === "sunday";
    const focusSessions = getDayFocusSessions(sessions, currentDateKey);
    const plannedHours = isWeekend || focusSessions.length === 0 ? 0 : getBillingScheduledHoursForDate(schedule, currentDateKey);
    const daySummary = getBillableDaySummary(sessions, currentDateKey, plannedHours, undefined, projects);
    const billablePercentage = plannedHours > 0 ? (daySummary.billableHours / plannedHours) * 100 : null;

    if (billablePercentage != null) {
      validPercentages.push(billablePercentage);
    }

    const rollingValues = validPercentages.slice(-rollingWindow);

    return {
      dateKey: currentDateKey,
      label: currentDateKey.slice(5),
      billableHours: daySummary.billableHours,
      plannedHours,
      billablePercentage,
      rollingAveragePercentage:
        rollingValues.length > 0 ? rollingValues.reduce((total, value) => total + value, 0) / rollingValues.length : null,
      hasLoggedWeekdayWork: plannedHours > 0,
    };
  });
}

export function getSuggestedBillableWeekTarget(
  sessions: FocusSession[],
  dateKey = getDateKey(),
  schedule: BillingSchedule = defaultSettings.billingSchedule,
  targetBillableRate = defaultSettings.billableTargetRate,
  projects: Array<Pick<Project, "id" | "title">> = [],
): SuggestedBillableWeekTarget {
  const { startDateKey } = getBillingWeekRange(dateKey);
  const currentWeekDateKeys = getDateKeysInRange(startDateKey, shiftDateKey(startDateKey, 6));
  const configuredWeekTargetHours =
    currentWeekDateKeys.reduce((total, currentDateKey) => total + getBillingScheduledHoursForDate(schedule, currentDateKey), 0) *
    targetBillableRate;
  const typicalBillingDayHours = getTypicalBillingDayHours(schedule);

  const completedWeeks = Array.from({ length: 4 }, (_, index) => {
    const weekStartDateKey = shiftDateKey(startDateKey, -(index + 1) * 7);
    const weekEndDateKey = shiftDateKey(weekStartDateKey, 6);
    const summaries = getBillableDaySummariesInRange(sessions, weekStartDateKey, weekEndDateKey, projects);
    const { billableHours } = mergeBillableDaySummaries(summaries);
    const workedDateKeys = new Set(
      getFocusSessions(getSessionsInRange(sessions, startOfDayIso(weekStartDateKey), endOfDayIso(weekEndDateKey)))
        .map((session) => getDateKey(new Date(session.startedAt))),
    );
    const workedHours = workedDateKeys.size * typicalBillingDayHours;
    const targetHours = workedHours * targetBillableRate;

    return {
      startDateKey: weekStartDateKey,
      endDateKey: weekEndDateKey,
      billableHours,
      workedHours,
      targetHours,
      hasSessions: workedDateKeys.size > 0,
    };
  }).filter((week) => week.hasSessions);

  if (completedWeeks.length === 0) {
    return {
      suggestedHours: configuredWeekTargetHours,
      baselineTargetHours: configuredWeekTargetHours,
      historicalAverageHours: null,
      deltaHours: 0,
      suggestedRate: targetBillableRate,
      baselineTargetRate: targetBillableRate,
      historicalAverageRate: null,
      deltaRate: 0,
      direction: "baseline",
      weeksUsed: 0,
      reason: "No completed week history yet; using configured target.",
    };
  }

  const historicalAverageHours =
    completedWeeks.reduce((total, week) => total + week.billableHours, 0) / completedWeeks.length;
  const historicalAverageRate =
    completedWeeks.reduce((total, week) => total + (week.workedHours > 0 ? week.billableHours / week.workedHours : targetBillableRate), 0) /
    completedWeeks.length;
  const baselineTargetHours =
    completedWeeks.reduce((total, week) => total + week.targetHours, 0) / completedWeeks.length;

  if (baselineTargetHours <= 0) {
    return {
      suggestedHours: configuredWeekTargetHours,
      baselineTargetHours: configuredWeekTargetHours,
      historicalAverageHours,
      deltaHours: 0,
      suggestedRate: targetBillableRate,
      baselineTargetRate: targetBillableRate,
      historicalAverageRate,
      deltaRate: 0,
      direction: "baseline",
      weeksUsed: completedWeeks.length,
      reason: `Last ${completedWeeks.length} weeks averaged ${(historicalAverageRate * 100).toFixed(1)}%, but worked-day targets are unavailable.`,
    };
  }

  const deltaRate = historicalAverageRate - targetBillableRate;
  const maxAdjustmentRate = targetBillableRate * 0.1;
  const adjustmentRate = Math.min(Math.abs(deltaRate), maxAdjustmentRate);
  const direction: SuggestedBillableWeekTarget["direction"] =
    deltaRate > 0 ? "rest" : deltaRate < 0 ? "catch-up" : "baseline";
  const suggestedRate =
    direction === "rest"
      ? targetBillableRate - adjustmentRate
      : direction === "catch-up"
        ? targetBillableRate + adjustmentRate
        : targetBillableRate;
  const currentWeekPlannedHours = targetBillableRate > 0 ? configuredWeekTargetHours / targetBillableRate : 0;
  const suggestedHours = currentWeekPlannedHours * suggestedRate;

  return {
    suggestedHours,
    baselineTargetHours: configuredWeekTargetHours,
    historicalAverageHours,
    deltaHours: historicalAverageHours - baselineTargetHours,
    suggestedRate,
    baselineTargetRate: targetBillableRate,
    historicalAverageRate,
    deltaRate,
    direction,
    weeksUsed: completedWeeks.length,
    reason:
      direction === "rest"
        ? `Last ${completedWeeks.length} weeks averaged ${(historicalAverageRate * 100).toFixed(1)}% billable on worked days, so this week can be lighter.`
        : direction === "catch-up"
          ? `Last ${completedWeeks.length} weeks averaged ${(historicalAverageRate * 100).toFixed(1)}% billable on worked days, so this week adds a small catch-up.`
          : `Last ${completedWeeks.length} weeks averaged ${(historicalAverageRate * 100).toFixed(1)}% billable on worked days, matching the configured target.`,
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
      isWeekday: !["saturday", "sunday"].includes(getBillingWeekdayKey(dateKey)),
    };
  });
}
