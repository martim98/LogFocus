"use client";

import { useMemo } from "react";
import type { FocusRewardLedger, FocusSession, Project, TimerSettings } from "@/lib/domain";
import { deriveFocusRewardBalance } from "@/lib/focus-rewards";
import { useAppStore } from "@/lib/store";
import { formatMinutes, getDateKey } from "@/lib/utils";
import { buildLiveFocusSession, useMinuteTick, useSecondTick } from "@/lib/timer-runtime";

type FocusRewardsCardProps = {
  sessions: FocusSession[];
  focusRewards: FocusRewardLedger;
  settings: TimerSettings;
  activeProject: Project | null;
  updateFocusRewards: (updates: Partial<FocusRewardLedger>) => Promise<boolean>;
};

export function FocusRewardsCard({ sessions, focusRewards, settings, activeProject, updateFocusRewards }: FocusRewardsCardProps) {
  const timer = useAppStore((state) => state.timer);
  const activeTaskName = useAppStore((state) => state.activeTaskName);
  const minuteTick = useMinuteTick(true);
  const secondTick = useSecondTick(timer.isRunning);
  const todayKey = getDateKey();
  const liveSessions = useMemo(() => {
    const activeSession = buildLiveFocusSession(timer, activeProject, activeTaskName);
    return activeSession ? [...sessions, activeSession] : sessions;
  }, [sessions, timer, activeProject, activeTaskName, secondTick]);
  const balance = useMemo(
    () => deriveFocusRewardBalance(liveSessions, focusRewards, settings, todayKey),
    [liveSessions, focusRewards, settings, todayKey, minuteTick, secondTick],
  );
  const displayMinutes = Math.trunc(balance.balanceMinutes);
  const progressLabel = `${formatMinutes(Math.round(balance.earnedFreeMinutes))} earned · ${formatMinutes(Math.round(balance.nonFocusMinutes))} used`;
  const bankPercent = useMemo(() => {
    if (settings.rewardMaxBankMinutes <= 0) return 0;
    return Math.min(100, Math.round((Math.max(balance.balanceMinutes, 0) / settings.rewardMaxBankMinutes) * 100));
  }, [balance.balanceMinutes, settings.rewardMaxBankMinutes]);

  function handleResetBank() {
    void updateFocusRewards({
      balanceOffsetDate: todayKey,
      balanceOffsetMinutes: -balance.rawBalanceMinutes,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <section className="panel rounded-[28px] border border-[rgba(var(--line),0.45)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[rgb(var(--muted))]">Free minutes</p>
          <h2 className={`mt-2 text-3xl font-semibold ${displayMinutes < 0 ? "text-red-300" : "text-white"}`}>
            {displayMinutes > 0 ? "+" : ""}{displayMinutes} min
          </h2>
        </div>
        <div className="rounded-2xl border border-[rgba(var(--line),0.4)] bg-[rgba(var(--bg),0.22)] px-4 py-2 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Status</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {settings.rewardEnabled ? (timer.isRunning ? "Earning" : displayMinutes < 0 ? "Recovering" : "Draining") : "Off"}
          </p>
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-[rgba(var(--line),0.35)]">
        <div className="h-full rounded-full bg-[rgb(var(--accent))]" style={{ width: `${bankPercent}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-[rgb(var(--muted))]">
        <span>{progressLabel}</span>
        <span>{Math.round(balance.targetProductivityRate * 100)}% productivity target</span>
      </div>

      <button
        type="button"
        disabled={Math.abs(balance.balanceMinutes) < 0.5}
        onClick={handleResetBank}
        className="mt-4 rounded-full border border-[rgba(var(--line),0.45)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--muted))] transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
      >
        Reset free minutes
      </button>

      {!settings.rewardEnabled ? (
        <p className="mt-3 text-sm text-[rgb(var(--muted))]">Rewards are disabled in settings.</p>
      ) : balance.focusMinutes === 0 ? (
        <p className="mt-3 text-sm text-[rgb(var(--muted))]">Start focusing to build free minutes from today’s log.</p>
      ) : balance.balanceMinutes < 0 ? (
        <p className="mt-3 text-sm text-[rgb(var(--muted))]">
          Focus {formatMinutes(Math.ceil(balance.recoveryFocusMinutes))} to return to zero.
        </p>
      ) : (
        <p className="mt-3 text-sm text-[rgb(var(--muted))]">Balance is inferred from today’s logged focus and elapsed free time.</p>
      )}
    </section>
  );
}
