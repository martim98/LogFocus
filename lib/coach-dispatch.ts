import type {
  DayCoachCueEvent,
  DayCoachEvaluation,
  DayCoachMemory,
  LiveBannerAlertEvaluation,
  LiveBannerAlertEvent,
  LiveBannerPaceSummary,
} from "@/lib/analytics";

const COACH_DISPATCH_STORAGE_KEY = "logfocus.coachDispatchedCues";
const COACH_DISPATCH_KEY_LIMIT = 50;
const COACH_STATUS_QUIET_MS = 60 * 60 * 1000;

export type CoachDispatchStore = Pick<Storage, "getItem" | "setItem">;

export type CoachDispatchLedger = {
  dateKey: string;
  keys: string[];
};

type CoachPriorityCue = {
  dateKey: string;
  event: DayCoachCueEvent | LiveBannerAlertEvent;
  title: string;
  message: string;
  tags: string;
  dispatchKey: string;
  billableAheadGapHours?: number;
  freeMinutes?: number;
};

export function getCoachCueDispatchKey(evaluation: {
  cueEvent: string | null;
  spokenMessage: string | null;
  memory: DayCoachMemory;
}) {
  if (!evaluation.cueEvent) return null;
  return [
    evaluation.memory.dateKey,
    evaluation.cueEvent,
    evaluation.memory.lastCueAtMs ?? "no-time",
    evaluation.spokenMessage ?? "no-message",
  ].join("::");
}

export function createCoachDispatchGate(memoryKeys = new Set<string>()) {
  let runtimeDateKey: string | null = null;

  return {
    shouldDispatch(params: {
      dateKey: string;
      dispatchKey: string | null;
      storage?: CoachDispatchStore | null;
    }) {
      const { dateKey, dispatchKey, storage } = params;
      if (!dispatchKey) return false;

      if (runtimeDateKey !== dateKey) {
        memoryKeys.clear();
        runtimeDateKey = dateKey;
      }

      const ledger = readCoachDispatchLedger(storage, dateKey);
      if (memoryKeys.has(dispatchKey) || ledger.keys.includes(dispatchKey)) {
        return false;
      }

      memoryKeys.add(dispatchKey);
      writeCoachDispatchLedger(storage, {
        dateKey,
        keys: [...ledger.keys, dispatchKey].slice(-COACH_DISPATCH_KEY_LIMIT),
      });
      return true;
    },
    _memoryKeys: memoryKeys,
  };
}

export function getLeanCoachPriorityCue(params: {
  pace: LiveBannerPaceSummary;
  coachEvaluation: DayCoachEvaluation;
  alertEvaluation: LiveBannerAlertEvaluation;
  productivityTargetRate: number;
  lastDispatchedAtMs: number | null;
  now: Date;
}): CoachPriorityCue | null {
  const { pace, coachEvaluation, alertEvaluation, now } = params;
  if (coachEvaluation.memory.muted) return null;

  if (coachEvaluation.cueEvent === "coachResume" && coachEvaluation.spokenMessage) {
    const dispatchKey = getCoachCueDispatchKey(coachEvaluation);
    if (!dispatchKey) return null;

    return {
      dateKey: coachEvaluation.memory.dateKey,
      event: "coachResume",
      title: `LogFocus Coach · ${coachEvaluation.title}`,
      message: coachEvaluation.spokenMessage,
      tags: "warning",
      dispatchKey,
    };
  }

  const breakEvent = getHighestBreakEvent(alertEvaluation.events);
  if (breakEvent) {
    const freeMinutes = alertEvaluation.breakSignal.freeMinutes ?? Math.max(0, Math.round(alertEvaluation.breakSignal.gapHours * 60));
    const message = getBreakCueMessage(freeMinutes);
    return {
      dateKey: pace.dateKey,
      event: breakEvent,
      title: "LogFocus Coach · Break",
      message,
      tags: "coffee",
      dispatchKey: [pace.dateKey, breakEvent, freeMinutes, message].join("::"),
      billableAheadGapHours: alertEvaluation.breakSignal.gapHours,
      freeMinutes,
    };
  }

  if (!shouldSendStatusCue(pace, params.lastDispatchedAtMs, now)) {
    return null;
  }

  const message = getStatusCueMessage(pace);
  return {
    dateKey: pace.dateKey,
    event: "coachStatus",
    title: "LogFocus Coach · Status",
    message,
    tags: "stopwatch",
    dispatchKey: [pace.dateKey, "coachStatus", getStatusCueBucket(now)].join("::"),
  };
}

export function readCoachDispatchLedger(storage: CoachDispatchStore | null | undefined, dateKey: string): CoachDispatchLedger {
  if (!storage) return { dateKey, keys: [] };

  try {
    const raw = storage.getItem(COACH_DISPATCH_STORAGE_KEY);
    if (!raw) return { dateKey, keys: [] };

    const parsed = JSON.parse(raw) as Partial<CoachDispatchLedger>;
    if (parsed.dateKey !== dateKey || !Array.isArray(parsed.keys)) {
      return { dateKey, keys: [] };
    }

    return {
      dateKey,
      keys: parsed.keys.filter((key): key is string => typeof key === "string").slice(-COACH_DISPATCH_KEY_LIMIT),
    };
  } catch {
    return { dateKey, keys: [] };
  }
}

function writeCoachDispatchLedger(storage: CoachDispatchStore | null | undefined, ledger: CoachDispatchLedger) {
  if (!storage) return;

  try {
    storage.setItem(COACH_DISPATCH_STORAGE_KEY, JSON.stringify(ledger));
  } catch {
    // In-memory dispatch still protects this tab if storage is unavailable.
  }
}

function getHighestBreakEvent(events: LiveBannerAlertEvent[]) {
  if (events.includes("breakRecommended20")) return "breakRecommended20";
  if (events.includes("breakRecommended15")) return "breakRecommended15";
  if (events.includes("breakRecommended10")) return "breakRecommended10";
  return null;
}

function shouldSendStatusCue(pace: LiveBannerPaceSummary, lastDispatchedAtMs: number | null, now: Date) {
  if (pace.rawFocusRemainingTodayHours == null || pace.rawFocusRemainingTodayHours <= 0) {
    return false;
  }

  return lastDispatchedAtMs != null && now.getTime() - lastDispatchedAtMs >= COACH_STATUS_QUIET_MS;
}

function getBreakCueMessage(minutes: number) {
  return `Break available. You have about ${Math.max(0, Math.trunc(minutes))} free minutes.`;
}

function getStatusCueMessage(pace: LiveBannerPaceSummary) {
  const score = `${pace.liveProductivityScore.toFixed(0)} percent`;
  const remaining = formatHoursForCue(pace.rawFocusRemainingTodayHours ?? 0);
  const finish = pace.finishAt ? ` Finish around ${formatTimeForCue(pace.finishAt)}.` : " No finish estimate yet.";
  return `Status update. Live score ${score}. ${remaining} left.${finish}`;
}

function formatHoursForCue(hours: number) {
  if (hours < 1) {
    return `${Math.max(0, Math.round(hours * 60))} minutes`;
  }

  return `${hours.toFixed(1)} hours`;
}

function formatTimeForCue(value: Date) {
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getStatusCueBucket(now: Date) {
  return Math.floor(now.getTime() / COACH_STATUS_QUIET_MS);
}
