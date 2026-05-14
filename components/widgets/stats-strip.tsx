"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FocusSession, Project, TimerSettings } from "@/lib/domain";
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
import { useAppStore } from "@/lib/store";
import { getDateKey } from "@/lib/utils";
import { playAlertAudio } from "@/lib/sound";
import { useLiveFocusSessions, useMinuteTick } from "@/lib/timer-runtime";

type StatsStripProps = {
  sessions: FocusSession[];
  projects: Project[];
  settings: TimerSettings;
};

export function StatsStrip({ sessions, projects, settings }: StatsStripProps) {
  const timer = useAppStore((state) => state.timer);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;

  const minuteTick = useMinuteTick(true);
  const { liveSessions, secondTick } = useLiveFocusSessions(sessions, activeProject);
  const todayKey = getDateKey();

  const billingCalendarSummary = useMemo(
    () => getBillingCalendarSummary(liveSessions, todayKey, settings.billingSchedule, settings.billableTargetRate, projects),
    [liveSessions, todayKey, settings.billingSchedule, settings.billableTargetRate, projects, minuteTick, secondTick],
  );
  const billableProgressToNow = useMemo(
    () =>
      getWorkweekBillableProgressToNow(
        liveSessions,
        todayKey,
        getTypicalBillingDayHours(settings.billingSchedule),
        settings.billableTargetRate,
        getBillingScheduleWorkdayCount(settings.billingSchedule),
        settings.billingWeekEndDay,
        settings.billingWeekEndTime,
        new Date(),
        projects,
      ),
    [
      liveSessions,
      todayKey,
      settings.billableTargetRate,
      settings.billingSchedule,
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
  const alertMemoryRef = useRef<LiveBannerAlertMemory>(createLiveBannerAlertMemory(todayKey));
  const coachMemoryRef = useRef<DayCoachMemory>(createDayCoachMemory(todayKey));
  const [coachRevision, setCoachRevision] = useState(0);
  const alertEvaluation = useMemo(
    () =>
      evaluateLiveBannerAlerts({
        pace: liveBannerPace,
        settings,
        memory: alertMemoryRef.current,
        timerIsRunning: timer.isRunning,
        now: new Date(),
      }),
    [liveBannerPace, settings, timer.isRunning, minuteTick, secondTick],
  );
  const coachEvaluation = useMemo(
    () =>
      evaluateDayCoach({
        pace: liveBannerPace,
        billingCalendarSummary,
        timerIsRunning: timer.isRunning,
        now: new Date(),
        productivityTargetRate: settings.rewardTargetRate,
        memory: coachMemoryRef.current,
      }),
    [liveBannerPace, billingCalendarSummary, timer.isRunning, settings.rewardTargetRate, coachRevision, minuteTick, secondTick],
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
    alertMemoryRef.current = alertEvaluation.memory;
    if (!settings.soundEnabled || settings.alertVoiceMode === "off") {
      return;
    }

    for (const event of alertEvaluation.events) {
      void playAlertAudio(settings.soundType, settings.alertVoiceMode, event, {
        billableAheadGapHours: alertEvaluation.breakSignal.gapHours,
      });
    }
  }, [alertEvaluation, settings.alertVoiceMode, settings.soundEnabled, settings.soundType]);

  useEffect(() => {
    coachMemoryRef.current = coachEvaluation.memory;
    if (coachEvaluation.cueEvent) {
      setCoachRevision((revision) => revision + 1);
    }
    if (!coachEvaluation.cueEvent || !settings.soundEnabled || settings.alertVoiceMode === "off") {
      return;
    }

    void playAlertAudio(settings.soundType, settings.alertVoiceMode, coachEvaluation.cueEvent, {
      spokenMessage: coachEvaluation.spokenMessage ?? undefined,
    });
  }, [coachEvaluation, settings.alertVoiceMode, settings.soundEnabled, settings.soundType]);

  function onMuteCoachToday() {
    const nextMemory = {
      ...coachMemoryRef.current,
      dateKey: todayKey,
      muted: true,
      updates: coachMemoryRef.current.dateKey === todayKey ? coachMemoryRef.current.updates : [],
    };
    coachMemoryRef.current = nextMemory;
    setCoachRevision((revision) => revision + 1);
  }

  return (
    <section className="panel relative overflow-hidden rounded-[26px] border border-[rgba(var(--line),0.4)] bg-[rgba(var(--bg-secondary),0.55)] p-4 sm:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(var(--accent),0.18),transparent_55%),radial-gradient(circle_at_top_right,rgba(var(--accent-alt),0.12),transparent_50%)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Today</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--line),0.35)] bg-[rgba(var(--bg),0.16)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">
          <span className="h-2 w-2 rounded-full bg-[rgb(var(--accent-strong))] shadow-[0_0_0_4px_rgba(255,255,255,0.05)]" />
          Live
        </div>
      </div>
      <div className="relative mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-9">
        <MetricCard
          label="Live score"
          value={`${liveScore.toFixed(1)}%`}
          helper={
            liveScoreFeedback
              ? `${liveScoreFeedback.delta > 0 ? "+" : ""}${liveScoreFeedback.delta.toFixed(1)}%`
              : undefined
          }
          tone={liveScoreFeedback?.tone ?? null}
        />
        <MetricCard
          label="Focus today"
          value={dailyTargetHours == null ? "Weekend" : `${formatHoursOneDecimal(todayLoggedHours)} / ${formatHoursOneDecimal(dailyTargetHours)}`}
        />
        <MetricCard label="Focus left" value={hoursNeededToday == null ? "Weekend" : formatHoursOneDecimal(hoursNeededToday)} />
        <MetricCard label="This week" value={`${formatHoursOneDecimal(visibleWeekLoggedHours)} logged`} />
        <MetricCard
          label="Billable need"
          value={billableNeededToday == null ? "Weekend" : formatHoursOneDecimal(billableNeededToday)}
          helper={`${formatHoursOneDecimal(liveBannerPace.weeklyRoundedBillableTargetHours)} weekly target`}
        />
        <MetricCard
          label="Break signal"
          value={alertEvaluation.breakSignal.label}
          helper={alertEvaluation.breakSignal.helper ?? undefined}
          tone={alertEvaluation.breakSignal.active ? "down" : null}
        />
        <MetricCard
          label="Billable % = billable / planned through today"
          value={`${workweekBillablePercent.toFixed(1)}%`}
        />
        <MetricCard
          label="Billable vs expected"
          value={`${formatHoursOneDecimal(billableProgressToNow.actualBillableHours)} / ${formatHoursOneDecimal(billableProgressToNow.expectedBillableHours)}`}
          helper={`${billableProgressToNow.deltaHours >= 0 ? "+" : ""}${formatHoursOneDecimal(billableProgressToNow.deltaHours)} vs configured target`}
        />
        <MetricCard
          label="Finish by"
          value={hoursNeededToday == null ? "Weekend" : hoursNeededToday === 0 ? "Done" : formatFinishAt(finishAt)}
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
        onMuteToday={onMuteCoachToday}
      />
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
  onMuteToday,
}: {
  title: string;
  message: string;
  helper: string;
  severity: "neutral" | "success" | "warning";
  nextCueAt: Date | null;
  updates: DayCoachUpdate[];
  muted: boolean;
  onMuteToday: () => void;
}) {
  const severityClass =
    severity === "success"
      ? "border-[rgba(var(--accent-strong),0.45)] bg-[rgba(var(--accent-strong),0.10)]"
      : severity === "warning"
        ? "border-[rgba(248,113,113,0.48)] bg-[rgba(248,113,113,0.08)]"
        : "border-[rgba(var(--line),0.35)] bg-[rgba(var(--bg),0.14)]";

  return (
    <div className={`relative mt-3 rounded-[18px] border px-3 py-3 ${severityClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Coach</p>
          <p className="mt-1 text-lg font-semibold text-white">{title}</p>
          <p className="text-sm font-semibold text-white/85">{message}</p>
          <p className="mt-1 text-xs text-[rgb(var(--muted))]">
            {helper}
            {nextCueAt ? ` · Next cue around ${formatCoachTime(nextCueAt)}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onMuteToday}
          disabled={muted}
          className="rounded-full border border-[rgba(var(--line),0.35)] bg-[rgba(var(--bg),0.18)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75 transition hover:border-[rgba(var(--accent),0.45)] disabled:cursor-default disabled:opacity-55"
        >
          {muted ? "Muted today" : "Mute coach today"}
        </button>
      </div>
      {updates.length > 0 ? (
        <div className="mt-3 border-t border-[rgba(var(--line),0.25)] pt-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Coach updates</p>
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
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MetricCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "up" | "down" | null;
}) {
  const toneClass =
    tone === "up"
      ? "border-[rgba(var(--accent-strong),0.55)] bg-[rgba(var(--accent-strong),0.12)] shadow-[0_0_0_1px_rgba(var(--accent-strong),0.12),0_0_24px_rgba(var(--accent-strong),0.12)]"
      : tone === "down"
        ? "border-[rgba(248,113,113,0.55)] bg-[rgba(248,113,113,0.08)] shadow-[0_0_0_1px_rgba(248,113,113,0.12),0_0_24px_rgba(248,113,113,0.10)]"
        : "";

  return (
    <div className={`rounded-[18px] border border-[rgba(var(--line),0.35)] bg-[rgba(var(--bg),0.14)] px-3 py-2.5 transition-all duration-300 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted))]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight text-white transition-colors duration-300 ${tone === "up" ? "text-[rgb(var(--accent-strong))]" : tone === "down" ? "text-red-300" : ""}`}>
        {value}
      </p>
      {helper ? (
        <p className={`mt-1 text-xs font-semibold ${tone === "up" ? "text-[rgb(var(--accent-strong))]" : tone === "down" ? "text-red-300" : "text-[rgb(var(--muted))]"}`}>
          {helper}
        </p>
      ) : null}
    </div>
  );
}
