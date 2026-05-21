import type { FocusRewardLedger, FocusSession, TimerSettings } from "@/lib/domain";
import { getDateKey } from "@/lib/utils";

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

const STRETCH_TARGET_RATE = 0.75;
const STRETCH_SCORE_THRESHOLD = 78;
const STRETCH_REMAINING_HOURS_THRESHOLD = 1;

export function getRewardDateKey(dateIso: string) {
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) {
    return getDateKey();
  }
  return getDateKey(parsed);
}

export function getEffectiveRewardTargetRate(settings: TimerSettings, ledger?: FocusRewardLedger | null, dateKey = getDateKey()) {
  if (
    ledger?.targetRateOverrideDate === dateKey &&
    ledger.targetRateOverride != null &&
    ledger.targetRateOverride > 0 &&
    ledger.targetRateOverride < 1
  ) {
    return ledger.targetRateOverride;
  }

  return settings.rewardTargetRate;
}

export function getRewardFreeMinutesPerFocusMinuteForRate(targetRate: number) {
  return (1 - targetRate) / targetRate;
}

export function calculateSessionRewardMinutes(session: FocusSession, settings: TimerSettings, ledger?: FocusRewardLedger | null) {
  if (!settings.rewardEnabled || session.mode !== "focus") {
    return 0;
  }

  const focusMinutes = Math.floor(session.actualDurationSec / 60);
  if (focusMinutes < settings.rewardMinFocusMinutes) {
    return 0;
  }

  const targetRate = getEffectiveRewardTargetRate(settings, ledger, getRewardDateKey(session.startedAt));
  return Math.floor(focusMinutes * getRewardFreeMinutesPerFocusMinuteForRate(targetRate));
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
    targetRateOverrideDate: null,
    targetRateOverride: null,
    targetRateOfferDismissedDate: null,
  };
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
  const targetProductivityRate = getEffectiveRewardTargetRate(settings, ledger, dateKey);
  const freeMinutesPerFocusMinute = getRewardFreeMinutesPerFocusMinuteForRate(targetProductivityRate);
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
    targetProductivityRate,
  };
}

export function getStretchTargetOffer(params: {
  settings: TimerSettings;
  ledger: FocusRewardLedger;
  dateKey?: string;
  rewardBalance: DerivedFocusRewardBalance;
  liveProductivityScore: number;
  rawFocusRemainingTodayHours: number | null;
}) {
  const dateKey = params.dateKey ?? getDateKey();
  if (!params.settings.rewardEnabled) return null;
  if (params.ledger.targetRateOfferDismissedDate === dateKey) return null;

  const currentTargetRate = getEffectiveRewardTargetRate(params.settings, params.ledger, dateKey);
  const retainedFreeMinutes = params.settings.rewardStretchReserveMinutes;
  const convertedFreeMinutes = Math.floor(params.rewardBalance.balanceMinutes - retainedFreeMinutes);
  if (currentTargetRate >= STRETCH_TARGET_RATE) return null;
  if (convertedFreeMinutes <= 0) return null;
  if (params.liveProductivityScore < STRETCH_SCORE_THRESHOLD) return null;
  if (params.rawFocusRemainingTodayHours == null || params.rawFocusRemainingTodayHours < STRETCH_REMAINING_HOURS_THRESHOLD) return null;

  const denominator = params.rewardBalance.focusMinutes + params.rewardBalance.nonFocusMinutes + retainedFreeMinutes - params.rewardBalance.offsetMinutes;
  if (params.rewardBalance.focusMinutes <= 0 || denominator <= 0) return null;

  const balancingTargetRate = params.rewardBalance.focusMinutes / denominator;
  const offeredTargetRate = Math.min(STRETCH_TARGET_RATE, Math.max(currentTargetRate, balancingTargetRate));
  if (offeredTargetRate <= currentTargetRate) return null;

  return {
    dateKey,
    currentTargetRate,
    offeredTargetRate,
    freeMinutes: params.rewardBalance.balanceMinutes,
    retainedFreeMinutes,
    convertedFreeMinutes,
    liveProductivityScore: params.liveProductivityScore,
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

  const rawAward = calculateSessionRewardMinutes(session, settings, normalized);
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
