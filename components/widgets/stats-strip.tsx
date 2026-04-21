"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FocusSession, Project, TimerSettings } from "@/lib/domain";
import {
  formatFinishAt,
  formatHoursOneDecimal,
  getDailyProductivity,
  getWorkweekBillableProgressToNow,
  getRemainingWorkdays,
  getWorkweekBillableSummary,
  getWorkweekLoggedHours,
} from "@/lib/analytics";
import { useAppStore } from "@/lib/store";
import { getDateKey } from "@/lib/utils";
import { buildLiveFocusSession, useMinuteTick, useSecondTick } from "@/lib/timer-runtime";

type StatsStripProps = {
  sessions: FocusSession[];
  projects: Project[];
  settings: TimerSettings;
};

export function StatsStrip({ sessions, projects, settings }: StatsStripProps) {
  const timer = useAppStore((state) => state.timer);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const activeTaskName = useAppStore((state) => state.activeTaskName);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;

  const minuteTick = useMinuteTick(true);
  const secondTick = useSecondTick(timer.isRunning);
  const todayKey = getDateKey();

  const liveSessions = useMemo(() => {
    const activeSession = buildLiveFocusSession(timer, activeProject, activeTaskName);
    return activeSession ? [...sessions, activeSession] : sessions;
  }, [sessions, timer, activeProject, activeTaskName, secondTick]);

  const todayProductivity = useMemo(
    () => getDailyProductivity(liveSessions, todayKey),
    [liveSessions, todayKey, minuteTick, secondTick],
  );
  const workweekBillableSummary = useMemo(
    () => getWorkweekBillableSummary(liveSessions, todayKey, settings.billingWorkHoursPerDay, settings.workweekDays),
    [liveSessions, todayKey, settings.billingWorkHoursPerDay, settings.workweekDays, minuteTick],
  );
  const billableProgressToNow = useMemo(
    () =>
      getWorkweekBillableProgressToNow(
        liveSessions,
        todayKey,
        settings.billingWorkHoursPerDay,
        settings.billableTargetRate,
        settings.workweekDays,
        settings.billingWeekEndDay,
        settings.billingWeekEndTime,
      ),
    [
      liveSessions,
      todayKey,
      settings.billingWorkHoursPerDay,
      settings.billableTargetRate,
      settings.workweekDays,
      settings.billingWeekEndDay,
      settings.billingWeekEndTime,
      minuteTick,
    ],
  );

  const liveScore = todayProductivity?.productivityScore ?? 0;
  const todayLoggedHours = (todayProductivity?.workTimeSec ?? 0) / 3600;
  const workweekBillablePercent =
    workweekBillableSummary.targetHoursThroughToday > 0
      ? (workweekBillableSummary.billableHours / workweekBillableSummary.targetHoursThroughToday) * 100
      : 0;

  const now = new Date();
  const remainingWorkdays = getRemainingWorkdays(now, settings.workweekDays);
  const weeklyTargetHours = settings.dailyWorkHours * settings.workweekDays;
  const workweekLoggedHours = getWorkweekLoggedHours(liveSessions, todayKey);
  const remainingWeeklyHours = Math.max(0, weeklyTargetHours - workweekLoggedHours);
  const hoursToTarget = remainingWorkdays > 0 ? remainingWeeklyHours / remainingWorkdays : null;
  const hoursNeededToday = hoursToTarget == null ? null : Math.max(hoursToTarget - todayLoggedHours, 0);
  const finishAt =
    hoursNeededToday == null ? null : hoursNeededToday > 0 ? new Date(Date.now() + hoursNeededToday * 3600 * 1000) : new Date();
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
      <div className="relative mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
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
        <MetricCard label="Today" value={`${formatHoursOneDecimal(todayLoggedHours)} / ${settings.dailyWorkHours.toFixed(1)}h`} />
        <MetricCard label="Needed today" value={hoursNeededToday == null ? "Weekend" : formatHoursOneDecimal(hoursNeededToday)} />
        <MetricCard label="This week" value={`${formatHoursOneDecimal(workweekLoggedHours)} logged`} />
        <MetricCard
          label="Billable % = billable / target-to-date"
          value={`${workweekBillablePercent.toFixed(1)}%`}
        />
        <MetricCard
          label="Billable vs expected"
          value={`${formatHoursOneDecimal(billableProgressToNow.actualBillableHours)} / ${formatHoursOneDecimal(billableProgressToNow.expectedBillableHours)}`}
          helper={`${billableProgressToNow.deltaHours >= 0 ? "+" : ""}${formatHoursOneDecimal(billableProgressToNow.deltaHours)} vs ${Math.round(settings.billableTargetRate * 100)}% target`}
        />
        <MetricCard
          label="Finish by"
          value={hoursNeededToday == null ? "Weekend" : hoursNeededToday === 0 ? "Done" : formatFinishAt(finishAt)}
        />
      </div>
    </section>
  );
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
