"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { FocusRewardLedger, FocusSession, Project, TimerSettings } from "@/lib/domain";
import {
  createDayCoachMemory,
  createLiveBannerAlertMemory,
  evaluateDayCoach,
  evaluateLiveBannerAlerts,
  formatFinishAt,
  formatHoursOneDecimal,
  getBillingScheduleWorkdayCount,
  getTypicalBillingDayHours,
  getBillingCalendarSummary,
  getLiveBannerPaceSummary,
  getVisibleWeekLoggedHours,
  getWorkweekBillableProgressToNow,
} from "@/lib/analytics";
import type { DayCoachMemory, DayCoachUpdate, LiveBannerAlertMemory } from "@/lib/analytics";
import { createCoachDispatchGate, getLeanCoachPriorityCue } from "@/lib/coach-dispatch";
import { deriveFocusRewardBalance, getStretchTargetOffer } from "@/lib/focus-rewards";
import { useFocusRewards } from "@/lib/hooks";
import { useAppStore } from "@/lib/store";
import { getDateKey } from "@/lib/utils";
import { sendNtfyCoachNotification } from "@/lib/ntfy";
import { playAlertAudio } from "@/lib/sound";
import { useLiveFocusSessions, useMinuteTick } from "@/lib/timer-runtime";

type StatsStripProps = {
  sessions: FocusSession[];
  projects: Project[];
  settings: TimerSettings;
};

const coachMemoryByDate = new Map<string, DayCoachMemory>();
const coachDispatchGate = createCoachDispatchGate();
const breakCueEvents = new Set(["breakRecommended", "breakRecommended10", "breakRecommended15", "breakRecommended20"]);

function getSharedCoachMemory(dateKey: string) {
  const memory = coachMemoryByDate.get(dateKey);
  if (memory) return memory;

  const nextMemory = createDayCoachMemory(dateKey);
  coachMemoryByDate.set(dateKey, nextMemory);
  return nextMemory;
}

function setSharedCoachMemory(memory: DayCoachMemory) {
  coachMemoryByDate.clear();
  coachMemoryByDate.set(memory.dateKey, memory);
}

export function StatsStrip({ sessions, projects, settings }: StatsStripProps) {
  const timer = useAppStore((state) => state.timer);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;

  const minuteTick = useMinuteTick(true);
  const { liveSessions, secondTick } = useLiveFocusSessions(sessions, activeProject);
  const { focusRewards, updateFocusRewards } = useFocusRewards();
  const todayKey = getDateKey();
  const typicalBillingDayHours = useMemo(() => getTypicalBillingDayHours(settings.billingSchedule), [settings.billingSchedule]);
  const billingScheduleWorkdayCount = useMemo(() => getBillingScheduleWorkdayCount(settings.billingSchedule), [settings.billingSchedule]);

  const billingCalendarSummary = useMemo(
    () => getBillingCalendarSummary(liveSessions, todayKey, settings.billingSchedule, settings.billableTargetRate, projects),
    [liveSessions, todayKey, settings.billingSchedule, settings.billableTargetRate, projects, minuteTick, secondTick],
  );
  const billableProgressToNow = useMemo(
    () =>
      getWorkweekBillableProgressToNow(
        liveSessions,
        todayKey,
        typicalBillingDayHours,
        settings.billableTargetRate,
        billingScheduleWorkdayCount,
        settings.billingWeekEndDay,
        settings.billingWeekEndTime,
        new Date(),
        projects,
      ),
    [
      liveSessions,
      todayKey,
      typicalBillingDayHours,
      billingScheduleWorkdayCount,
      settings.billableTargetRate,
      settings.billingWeekEndDay,
      settings.billingWeekEndTime,
      projects,
      minuteTick,
    ],
  );
  const liveBannerPace = useMemo(
    () =>
      getLiveBannerPaceSummary(
        liveSessions,
        todayKey,
        settings.billingSchedule,
        settings.billableTargetRate,
        settings.billableRawToRoundedRate,
        new Date(),
        projects,
      ),
    [
      liveSessions,
      todayKey,
      settings.billingSchedule,
      settings.billableTargetRate,
      settings.billableRawToRoundedRate,
      projects,
      minuteTick,
      secondTick,
    ],
  );

  const liveScore = liveBannerPace.liveProductivityScore;
  const todayLoggedHours = liveBannerPace.todayLoggedRawFocusHours;
  const workweekBillablePercent =
    billingCalendarSummary.currentPlannedHours > 0
      ? (billingCalendarSummary.totalBillableHours / billingCalendarSummary.currentPlannedHours) * 100
      : 0;

  const visibleWeekLoggedHours = getVisibleWeekLoggedHours(liveSessions, todayKey);
  const dailyTargetHours = liveBannerPace.rawFocusTargetTodayHours;
  const hoursNeededToday = liveBannerPace.rawFocusRemainingTodayHours;
  const billableNeededToday = liveBannerPace.roundedBillableNeededTodayHours;
  const finishAt = liveBannerPace.finishAt;
  const firstFocusStartedAt = useMemo(() => getFirstFocusStartedAt(liveSessions, todayKey), [liveSessions, todayKey]);
  const rewardBalance = useMemo(
    () => deriveFocusRewardBalance(liveSessions, focusRewards, settings, todayKey),
    [liveSessions, focusRewards, settings, todayKey, minuteTick, secondTick],
  );
  const freeMinutes = Math.trunc(rewardBalance.balanceMinutes);
  const effectiveTargetRate = rewardBalance.targetProductivityRate;
  const stretchTargetRate = Math.min(effectiveTargetRate + 0.05, 0.99);
  const finishAtEffectiveTarget = useMemo(
    () => getAnchoredFinishAtForProductivity(firstFocusStartedAt, dailyTargetHours, effectiveTargetRate),
    [firstFocusStartedAt, dailyTargetHours, effectiveTargetRate],
  );
  const finishAtStretchTarget = useMemo(
    () => getAnchoredFinishAtForProductivity(firstFocusStartedAt, dailyTargetHours, stretchTargetRate),
    [firstFocusStartedAt, dailyTargetHours, stretchTargetRate],
  );
  const stretchOffer = useMemo(
    () =>
      getStretchTargetOffer({
        settings,
        ledger: focusRewards,
        dateKey: todayKey,
        rewardBalance,
        liveProductivityScore: liveScore,
        rawFocusRemainingTodayHours: hoursNeededToday,
      }),
    [settings, focusRewards, todayKey, rewardBalance, liveScore, hoursNeededToday],
  );
  const freeMinutesLabel = settings.rewardEnabled ? `${formatSignedMinutes(freeMinutes)} free min` : "Free minutes off";
  const alertMemoryRef = useRef<LiveBannerAlertMemory>(createLiveBannerAlertMemory(todayKey));
  const coachMemoryRef = useRef<DayCoachMemory>(getSharedCoachMemory(todayKey));
  const lastPriorityCueAtMsRef = useRef<number | null>(Date.now());
  const [coachRevision, setCoachRevision] = useState(0);
  const alertEvaluation = useMemo(
    () =>
      evaluateLiveBannerAlerts({
        pace: liveBannerPace,
        settings,
        memory: alertMemoryRef.current,
        timerIsRunning: timer.isRunning,
        now: new Date(),
        breakAvailableMinutes: settings.rewardEnabled ? freeMinutes : null,
      }),
    [liveBannerPace, settings, timer.isRunning, freeMinutes, minuteTick, secondTick],
  );
  const coachEvaluation = useMemo(
    () =>
      evaluateDayCoach({
        pace: liveBannerPace,
        billingCalendarSummary,
        timerIsRunning: timer.isRunning,
        now: new Date(),
        productivityTargetRate: effectiveTargetRate,
        memory: coachMemoryRef.current,
      }),
    [liveBannerPace, billingCalendarSummary, timer.isRunning, effectiveTargetRate, coachRevision, minuteTick, secondTick],
  );
  const priorityCue = useMemo(
    () =>
      getLeanCoachPriorityCue({
        pace: liveBannerPace,
        coachEvaluation,
        alertEvaluation,
        productivityTargetRate: effectiveTargetRate,
        lastDispatchedAtMs: lastPriorityCueAtMsRef.current,
        now: new Date(),
      }),
    [liveBannerPace, coachEvaluation, alertEvaluation, effectiveTargetRate, minuteTick, secondTick],
  );
  const [liveScoreFeedback, setLiveScoreFeedback] = useState<{ tone: "up" | "down"; delta: number } | null>(null);
  const previousLiveScoreRef = useRef(liveScore);

  useEffect(() => {
    const previous = previousLiveScoreRef.current;
    if (previous === liveScore) {
      return;
    }

    const delta = liveScore - previous;
    setLiveScoreFeedback({ tone: delta > 0 ? "up" : "down", delta });
    previousLiveScoreRef.current = liveScore;

    const timeoutId = window.setTimeout(() => {
      setLiveScoreFeedback(null);
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [liveScore]);

  useEffect(() => {
    lastPriorityCueAtMsRef.current = Date.now();
  }, [todayKey]);

  useEffect(() => {
    alertMemoryRef.current = alertEvaluation.memory;
    if (!settings.soundEnabled || settings.alertVoiceMode === "off") {
      return;
    }

    for (const event of alertEvaluation.events.filter((item) => !breakCueEvents.has(item))) {
      void playAlertAudio(settings.soundType, settings.alertVoiceMode, event, {
        billableAheadGapHours: alertEvaluation.breakSignal.gapHours,
      });
    }
  }, [alertEvaluation, settings.alertVoiceMode, settings.soundEnabled, settings.soundType]);

  useEffect(() => {
    coachMemoryRef.current = coachEvaluation.memory;
    setSharedCoachMemory(coachEvaluation.memory);
    if (coachEvaluation.cueEvent) {
      setCoachRevision((revision) => revision + 1);
    }
    if (!priorityCue) {
      return;
    }

    if (
      !coachDispatchGate.shouldDispatch({
        dateKey: priorityCue.dateKey,
        dispatchKey: priorityCue.dispatchKey,
        storage: typeof window === "undefined" ? null : window.localStorage,
      })
    ) {
      return;
    }

    lastPriorityCueAtMsRef.current = Date.now();
    void sendNtfyCoachNotification(settings, {
      title: priorityCue.title,
      message: priorityCue.message,
      tags: priorityCue.tags,
    });

    if (!settings.soundEnabled || settings.alertVoiceMode === "off") {
      return;
    }

    void playAlertAudio(settings.soundType, settings.alertVoiceMode, priorityCue.event, {
      billableAheadGapHours: priorityCue.billableAheadGapHours,
      freeMinutes: priorityCue.freeMinutes,
      spokenMessage: priorityCue.message,
    });
  }, [coachEvaluation, priorityCue, settings, settings.alertVoiceMode, settings.soundEnabled, settings.soundType]);

  function onMuteCoachToday() {
    const nextMemory = {
      ...coachMemoryRef.current,
      dateKey: todayKey,
      muted: true,
      updates: coachMemoryRef.current.dateKey === todayKey ? coachMemoryRef.current.updates : [],
    };
    coachMemoryRef.current = nextMemory;
    setSharedCoachMemory(nextMemory);
    setCoachRevision((revision) => revision + 1);
  }

  function updateFocusRewardStretch(updates: Partial<FocusRewardLedger>) {
    void updateFocusRewards({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  function onAcceptStretchTarget() {
    if (!stretchOffer) return;
    updateFocusRewardStretch({
      targetRateOverrideDate: todayKey,
      targetRateOverride: stretchOffer.offeredTargetRate,
    });
  }

  function onDismissStretchTarget() {
    updateFocusRewardStretch({
      targetRateOfferDismissedDate: todayKey,
    });
  }

  return (
    <section className="panel relative overflow-hidden rounded-2xl border border-[rgba(var(--line),0.4)] bg-[rgba(var(--bg-secondary),0.55)] p-4 sm:p-5">
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Today</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-[rgba(var(--line),0.35)] bg-[rgba(var(--bg),0.16)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75">
          <span className="h-2 w-2 rounded-full bg-[rgb(var(--accent-strong))] shadow-[0_0_0_4px_rgba(255,255,255,0.05)]" />
          Live
        </div>
      </div>

      <div className="relative mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.62fr)]">
        <div className="grid gap-3 sm:grid-cols-3">
          <PrimaryMetric
            label="Live score"
            value={`${liveScore.toFixed(1)}%`}
            footer={<DeltaBadge feedback={liveScoreFeedback} />}
            tone={liveScoreFeedback?.tone ?? null}
            title="Target-bounded productivity score for today's logged focus."
          />
          <PrimaryMetric
            label="Focus left"
            value={hoursNeededToday == null ? "Weekend" : formatHoursOneDecimal(hoursNeededToday)}
            footer={dailyTargetHours == null ? "No scheduled billing target" : `${formatHoursOneDecimal(todayLoggedHours)} logged today`}
            title="Raw focus remaining against today's billing-derived target."
          />
          <PrimaryMetric
            label="Finish by"
            value={hoursNeededToday == null ? "Weekend" : hoursNeededToday === 0 ? "Done" : formatFinishAt(finishAt)}
            footer={
              <FinishByFooter
                hoursNeededToday={hoursNeededToday}
                targetRate={effectiveTargetRate}
                targetFinishAt={finishAtEffectiveTarget}
                stretchRate={stretchTargetRate}
                stretchFinishAt={finishAtStretchTarget}
              />
            }
            title="Estimated finish time based on live productivity pace."
          />
        </div>

        <CoachPanel
          title={coachEvaluation.title}
          message={coachEvaluation.message}
          helper={coachEvaluation.helper}
          severity={coachEvaluation.severity}
          nextCueAt={coachEvaluation.nextCueAt}
          updates={coachEvaluation.memory.updates}
          muted={coachEvaluation.memory.muted}
          stretchOffer={stretchOffer}
          defaultTargetRate={settings.rewardTargetRate}
          onMuteToday={onMuteCoachToday}
          onAcceptStretchTarget={onAcceptStretchTarget}
          onDismissStretchTarget={onDismissStretchTarget}
        />
      </div>

      <div className="relative mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3 2xl:grid-cols-6">
        <CompactMetric
          label="Focus today"
          value={dailyTargetHours == null ? "Weekend" : `${formatHoursOneDecimal(todayLoggedHours)} / ${formatHoursOneDecimal(dailyTargetHours)}`}
          title="Logged raw focus compared with today's raw target."
        />
        <CompactMetric
          label="Week"
          value={`${formatHoursOneDecimal(visibleWeekLoggedHours)} logged`}
          title="Visible billing-week logged focus."
        />
        <CompactMetric
          label="Billable need"
          value={billableNeededToday == null ? "Weekend" : formatHoursOneDecimal(billableNeededToday)}
          helper={`${formatHoursOneDecimal(liveBannerPace.weeklyRoundedBillableTargetHours)} weekly`}
          title="Rounded billable hours needed today."
        />
        <CompactMetric
          label="Break"
          value={alertEvaluation.breakSignal.label}
          helper={freeMinutesLabel}
          tone={alertEvaluation.breakSignal.active ? "down" : null}
          title="Break recommendation with current derived free-minute balance."
        />
        <CompactMetric
          label="Billable %"
          value={`${workweekBillablePercent.toFixed(1)}%`}
          title="Billable hours divided by planned hours through today."
        />
        <CompactMetric
          label="Vs expected"
          value={`${formatHoursOneDecimal(billableProgressToNow.actualBillableHours)} / ${formatHoursOneDecimal(billableProgressToNow.expectedBillableHours)}`}
          helper={`${billableProgressToNow.deltaHours >= 0 ? "+" : ""}${formatHoursOneDecimal(billableProgressToNow.deltaHours)}`}
          title="Actual rounded billable hours compared with configured expected pace."
        />
      </div>
    </section>
  );
}

function CoachPanel({
  title,
  message,
  helper,
  severity,
  nextCueAt,
  updates,
  muted,
  stretchOffer,
  defaultTargetRate,
  onMuteToday,
  onAcceptStretchTarget,
  onDismissStretchTarget,
}: {
  title: string;
  message: string;
  helper: string;
  severity: "neutral" | "success" | "warning";
  nextCueAt: Date | null;
  updates: DayCoachUpdate[];
  muted: boolean;
  stretchOffer: ReturnType<typeof getStretchTargetOffer>;
  defaultTargetRate: number;
  onMuteToday: () => void;
  onAcceptStretchTarget: () => void;
  onDismissStretchTarget: () => void;
}) {
  const severityClass =
    severity === "success"
      ? "border-[rgba(var(--accent-strong),0.38)] bg-[rgba(var(--accent-strong),0.08)]"
      : severity === "warning"
        ? "border-[rgba(248,113,113,0.42)] bg-[rgba(248,113,113,0.07)]"
        : "border-[rgba(var(--line),0.32)] bg-[rgba(var(--bg),0.12)]";
  const heightClass = stretchOffer || updates.length > 0 ? "min-h-[12rem]" : "min-h-[7.75rem] sm:min-h-[8.75rem]";

  return (
    <div className={`relative flex flex-col justify-between rounded-xl border px-3 py-3 ${heightClass} ${severityClass}`}>
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[rgb(var(--muted))]">Coach</p>
              <p className="mt-1 truncate text-lg font-semibold text-white">{title}</p>
            </div>
            <button
              type="button"
              onClick={onMuteToday}
              disabled={muted}
              className="shrink-0 rounded-xl border border-[rgba(var(--line),0.35)] bg-[rgba(var(--bg),0.18)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/75 transition hover:border-[rgba(var(--accent),0.45)] disabled:cursor-default disabled:opacity-55"
            >
              {muted ? "Muted" : "Mute"}
            </button>
          </div>
          <p className="mt-1 line-clamp-1 text-sm font-semibold text-white/85">{message}</p>
          <p className="mt-1 line-clamp-1 text-xs text-[rgb(var(--muted))]">
            {helper}
            {nextCueAt ? ` · Next cue around ${formatCoachTime(nextCueAt)}` : ""}
          </p>
        </div>
      </div>
      {stretchOffer ? (
        <div className="mt-3 rounded-lg border border-[rgba(var(--accent-strong),0.32)] bg-[rgba(var(--accent-strong),0.07)] px-3 py-2">
          <p className="text-xs font-semibold text-white">
            Keep +{stretchOffer.retainedFreeMinutes} min free. Convert +{stretchOffer.convertedFreeMinutes} min into today&apos;s target?
          </p>
          <p className="mt-1 text-[11px] text-[rgb(var(--muted))]">
            Raises today to {Math.round(stretchOffer.offeredTargetRate * 100)}%. Tomorrow returns to {Math.round(defaultTargetRate * 100)}%.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onAcceptStretchTarget}
              className="rounded-lg bg-[rgb(var(--accent))] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white transition hover:brightness-110"
            >
              Convert surplus
            </button>
            <button
              type="button"
              onClick={onDismissStretchTarget}
              className="rounded-lg border border-[rgba(var(--line),0.35)] bg-[rgba(var(--bg),0.18)] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              Not today
            </button>
          </div>
        </div>
      ) : null}
      {updates.length > 0 ? (
        <div className="mt-3 border-t border-[rgba(var(--line),0.25)] pt-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[rgb(var(--muted))]">Coach updates</p>
          <div className="mt-2 grid gap-1">
            {updates.map((update) => (
              <p key={update.id} className="text-xs font-medium text-white/75">
                {formatCoachTime(new Date(update.at))} · {update.label} · {update.message.replace(/^.*? · /, "")}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatCoachTime(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function formatSignedMinutes(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function getFirstFocusStartedAt(sessions: FocusSession[], dateKey: string) {
  let firstStartedAt: string | null = null;

  for (const session of sessions) {
    if (session.mode !== "focus" || getDateKey(new Date(session.startedAt)) !== dateKey) continue;
    if (firstStartedAt == null || session.startedAt < firstStartedAt) {
      firstStartedAt = session.startedAt;
    }
  }

  return firstStartedAt ? new Date(firstStartedAt) : null;
}

function getAnchoredFinishAtForProductivity(startedAt: Date | null, dailyTargetHours: number | null, productivityRate: number) {
  if (startedAt == null || dailyTargetHours == null || dailyTargetHours <= 0 || productivityRate <= 0) {
    return null;
  }

  return new Date(startedAt.getTime() + (dailyTargetHours / productivityRate) * 3600 * 1000);
}

function FinishByFooter({
  hoursNeededToday,
  targetRate,
  targetFinishAt,
  stretchRate,
  stretchFinishAt,
}: {
  hoursNeededToday: number | null;
  targetRate: number;
  targetFinishAt: Date | null;
  stretchRate: number;
  stretchFinishAt: Date | null;
}) {
  if (hoursNeededToday == null) {
    return "No scheduled billing target";
  }

  if (hoursNeededToday === 0) {
    return "Target complete";
  }

  return (
    <div className="grid gap-1">
      <span>At current live pace</span>
      <span className="font-medium text-white/70">
        {formatProductivityRate(targetRate)} {formatFinishAt(targetFinishAt)} ·{" "}
        {formatProductivityRate(stretchRate)} {formatFinishAt(stretchFinishAt)}
      </span>
    </div>
  );
}

function formatProductivityRate(rate: number) {
  return `${Math.round(Math.max(0, Math.min(rate, 0.99)) * 100)}%`;
}

function PrimaryMetric({
  label,
  value,
  footer,
  tone,
  title,
}: {
  label: string;
  value: string;
  footer: React.ReactNode;
  tone?: "up" | "down" | null;
  title?: string;
}) {
  const toneClass =
    tone === "up"
      ? "border-[rgba(var(--accent-strong),0.48)] bg-[rgba(var(--accent-strong),0.10)]"
      : tone === "down"
        ? "border-[rgba(248,113,113,0.48)] bg-[rgba(248,113,113,0.07)]"
        : "";

  return (
    <div
      title={title}
      className={`flex min-h-[7.75rem] flex-col justify-between rounded-xl border border-[rgba(var(--line),0.35)] bg-[rgba(var(--bg),0.14)] px-3 py-3 transition-colors duration-300 sm:min-h-[8.75rem] ${toneClass}`}
    >
      <p className="truncate text-[10px] uppercase tracking-[0.16em] text-[rgb(var(--muted))]">{label}</p>
      <p className={`text-2xl font-semibold text-white transition-colors duration-300 sm:text-3xl ${tone === "up" ? "text-[rgb(var(--accent-strong))]" : tone === "down" ? "text-red-300" : ""}`}>
        {value}
      </p>
      <div className="min-h-6 text-xs font-semibold text-[rgb(var(--muted))]">{footer}</div>
    </div>
  );
}

function CompactMetric({
  label,
  value,
  helper,
  tone,
  title,
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "up" | "down" | null;
  title?: string;
}) {
  const toneClass =
    tone === "down"
      ? "border-[rgba(248,113,113,0.38)] bg-[rgba(248,113,113,0.06)]"
      : tone === "up"
        ? "border-[rgba(var(--accent-strong),0.38)] bg-[rgba(var(--accent-strong),0.08)]"
        : "border-[rgba(var(--line),0.28)] bg-[rgba(var(--bg),0.10)]";

  return (
    <div title={title} className={`min-h-[5.75rem] rounded-xl border px-2.5 py-2.5 sm:px-3 ${toneClass}`}>
      <p className="truncate text-[10px] uppercase tracking-[0.14em] text-[rgb(var(--muted))]">{label}</p>
      <p className={`mt-1 truncate text-lg font-semibold text-white ${tone === "down" ? "text-red-300" : tone === "up" ? "text-[rgb(var(--accent-strong))]" : ""}`}>
        {value}
      </p>
      <p className="mt-1 min-h-4 truncate text-xs font-medium text-[rgb(var(--muted))]">{helper ?? ""}</p>
    </div>
  );
}

function DeltaBadge({ feedback }: { feedback: { tone: "up" | "down"; delta: number } | null }) {
  const label = feedback ? `${feedback.delta > 0 ? "+" : ""}${feedback.delta.toFixed(1)}%` : "steady";
  const toneClass =
    feedback?.tone === "up"
      ? "border-[rgba(var(--accent-strong),0.45)] text-[rgb(var(--accent-strong))]"
      : feedback?.tone === "down"
        ? "border-[rgba(248,113,113,0.45)] text-red-300"
        : "border-[rgba(var(--line),0.35)] text-[rgb(var(--muted))]";

  return (
    <div className={`inline-flex h-6 min-w-[4.75rem] items-center justify-center rounded-lg border px-2 text-[11px] font-semibold tabular-nums ${toneClass}`}>
      {label}
    </div>
  );
}
