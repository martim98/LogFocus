import type { FocusRewardLedger, FocusSession, TimerSettings } from "@/lib/domain";
import { getDateKey } from "@/lib/utils";

export type AwardedSession = FocusRewardLedger["awardedSessions"][string];

export type DerivedFocusRewardBalance = {
  dateKey: string;
  focusMinutes: number;
  elapsedMinutes: number;
  nonFocusMinutes: number;
  earnedFreeMinutes: number;
  rawBalanceMinutes: number;
  offsetMinutes: number;
  balanceMinutes: number;
  recoveryFocusMinutes: number;
  targetProductivityRate: number;
};

export function getRewardDateKey(dateIso: string) {
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) {
    return getDateKey();
  }
  return getDateKey(parsed);
}

export function calculateSessionRewardMinutes(session: FocusSession, settings: TimerSettings) {
  if (!settings.rewardEnabled || session.mode !== "focus") {
    return 0;
  }

  const focusMinutes = Math.floor(session.actualDurationSec / 60);
  if (focusMinutes < settings.rewardMinFocusMinutes) {
    return 0;
  }

  return Math.floor(focusMinutes * ((1 - settings.rewardTargetRate) / settings.rewardTargetRate));
}

export function normalizeLedgerForDate(ledger: FocusRewardLedger, dateKey: string): FocusRewardLedger {
  if (ledger.earnedTodayDate === dateKey) {
    return ledger;
  }

  return {
    ...ledger,
    bankMinutes: 0,
    earnedTodayDate: dateKey,
    earnedTodayMinutes: 0,
    awardedSessions: {},
    balanceOffsetMinutes: 0,
    balanceOffsetDate: null,
  };
}

export function getRewardTargetProductivityRate(settings: TimerSettings) {
  return settings.rewardTargetRate;
}

export function getRewardFreeMinutesPerFocusMinute(settings: TimerSettings) {
  return (1 - settings.rewardTargetRate) / settings.rewardTargetRate;
}

export function deriveFocusRewardBalance(
  sessions: FocusSession[],
  ledger: FocusRewardLedger,
  settings: TimerSettings,
  dateKey = getDateKey(),
  nowMs = Date.now(),
): DerivedFocusRewardBalance {
  const focusSessions = sessions
    .filter((session) => session.mode === "focus" && getRewardDateKey(session.startedAt) === dateKey)
    .slice()
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const focusMinutes = focusSessions.reduce((total, session) => total + session.actualDurationSec / 60, 0);
  const firstStartMs = focusSessions.length > 0 ? Date.parse(focusSessions[0].startedAt) : Number.NaN;
  const elapsedMinutes = Number.isNaN(firstStartMs) ? 0 : Math.max(0, (nowMs - firstStartMs) / 60_000);
  const nonFocusMinutes = Math.max(0, elapsedMinutes - focusMinutes);
  const freeMinutesPerFocusMinute = getRewardFreeMinutesPerFocusMinute(settings);
  const earnedFreeMinutes = focusMinutes * freeMinutesPerFocusMinute;
  const rawBalanceMinutes = earnedFreeMinutes - nonFocusMinutes;
  const offsetMinutes = ledger.balanceOffsetDate === dateKey ? ledger.balanceOffsetMinutes : 0;
  const balanceMinutes = rawBalanceMinutes + offsetMinutes;

  return {
    dateKey,
    focusMinutes,
    elapsedMinutes,
    nonFocusMinutes,
    earnedFreeMinutes,
    rawBalanceMinutes,
    offsetMinutes,
    balanceMinutes,
    recoveryFocusMinutes: balanceMinutes < 0 ? Math.abs(balanceMinutes) / freeMinutesPerFocusMinute : 0,
    targetProductivityRate: getRewardTargetProductivityRate(settings),
  };
}

export function awardFocusSessionReward(
  ledger: FocusRewardLedger,
  session: FocusSession,
  settings: TimerSettings,
  nowIso = new Date().toISOString(),
): FocusRewardLedger {
  const earnedDate = getRewardDateKey(session.startedAt);
  const normalized = normalizeLedgerForDate(ledger, getRewardDateKey(nowIso));
  const previousAward = normalized.awardedSessions[session.id]?.minutes ?? 0;
  if (earnedDate !== normalized.earnedTodayDate) {
    return previousAward > 0 ? removeFocusSessionReward(normalized, session.id, nowIso) : normalized;
  }

  const rawAward = calculateSessionRewardMinutes(session, settings);
  const remainingDailyCap = Math.max(settings.rewardDailyCapMinutes - normalized.earnedTodayMinutes + previousAward, 0);
  const remainingBankCap = Math.max(settings.rewardMaxBankMinutes - normalized.bankMinutes + previousAward, 0);
  const nextAward = Math.min(rawAward, remainingDailyCap, remainingBankCap);
  const bankMinutes = Math.max(0, normalized.bankMinutes - previousAward + nextAward);
  const earnedTodayMinutes = Math.max(0, normalized.earnedTodayMinutes - previousAward + nextAward);
  const awardedSessions = { ...normalized.awardedSessions };

  if (nextAward > 0) {
    awardedSessions[session.id] = { minutes: nextAward, earnedDate };
  } else {
    delete awardedSessions[session.id];
  }

  return {
    ...normalized,
    bankMinutes,
    earnedTodayMinutes,
    awardedSessions,
    updatedAt: nowIso,
  };
}

export function removeFocusSessionReward(
  ledger: FocusRewardLedger,
  sessionId: string,
  nowIso = new Date().toISOString(),
): FocusRewardLedger {
  const previousAward = ledger.awardedSessions[sessionId];
  if (!previousAward) {
    return ledger;
  }

  const awardedSessions = { ...ledger.awardedSessions };
  delete awardedSessions[sessionId];

  return {
    ...ledger,
    bankMinutes: Math.max(0, ledger.bankMinutes - previousAward.minutes),
    earnedTodayMinutes: previousAward.earnedDate === ledger.earnedTodayDate
      ? Math.max(0, ledger.earnedTodayMinutes - previousAward.minutes)
      : ledger.earnedTodayMinutes,
    awardedSessions,
    updatedAt: nowIso,
  };
}

export function spendFocusRewardMinutes(
  ledger: FocusRewardLedger,
  minutes: number,
  nowIso = new Date().toISOString(),
): FocusRewardLedger {
  const normalized = normalizeLedgerForDate(ledger, getRewardDateKey(nowIso));
  const spentMinutes = Math.max(0, Math.floor(minutes));
  return {
    ...normalized,
    bankMinutes: normalized.bankMinutes - spentMinutes,
    updatedAt: nowIso,
  };
}
