"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { CalendarRange, Clock3, Percent, ShieldAlert } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  formatHoursDecimal,
  formatHoursOneDecimal,
  getBillableDaySummary,
  getWorkweekBillableProgressToNow,
} from "@/lib/analytics";
import { getDateKey } from "@/lib/utils";
import { useProjects, useSessions, useSettings } from "@/lib/hooks";
import { buildLiveFocusSession, useMinuteTick } from "@/lib/timer-runtime";

const weekdayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function BillableLogView() {
  const { sessions } = useSessions();
  const { projects } = useProjects();
  const { settings } = useSettings();

  const timer = useAppStore((state) => state.timer);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const activeTaskName = useAppStore((state) => state.activeTaskName);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;

  const minuteTick = useMinuteTick(timer.isRunning);
  const todayKey = getDateKey();

  const liveSessions = useMemo(() => {
    const activeSession = buildLiveFocusSession(timer, activeProject, activeTaskName);
    return activeSession ? [...sessions, activeSession] : sessions;
  }, [sessions, timer.isRunning, timer.startedAt, timer.mode, timer.activeSessionId, activeProject, activeTaskName]);

  const progress = useMemo(
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

  const todaySummary = useMemo(
    () => getBillableDaySummary(liveSessions, todayKey, settings.billingWorkHoursPerDay, settings.billableTargetRate),
    [liveSessions, todayKey, settings.billingWorkHoursPerDay, settings.billableTargetRate, minuteTick],
  );

  const cutoffLabel = `${weekdayLabels[settings.billingWeekEndDay]} ${settings.billingWeekEndTime}`;
  const targetBillableHours = settings.billingWorkHoursPerDay * settings.workweekDays * settings.billableTargetRate;
  const ahead = Math.max(0, progress.deltaHours);
  const behind = Math.max(0, -progress.deltaHours);
  const expectedBillableSpeed = `(+${formatHoursDecimal(progress.expectedBillableHoursPerHour)}/h)`;

  return (
    <main className="flex flex-col gap-6">
      <section className="panel rounded-[28px] p-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Billing progress</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Billable time against the configured cutoff.</h1>
            <p className="mt-2 max-w-2xl text-sm text-[rgb(var(--muted))]">
              This page uses the same cutoff-based billing window as the live score: the configured end day and time, then the first session logged after the previous cutoff.
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-sm text-[rgb(var(--muted))]">
            Cutoff: {cutoffLabel}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Billable now"
          value={formatHoursDecimal(progress.actualBillableHours)}
          helper="Rounded billable time in the current billing window"
          icon={<Clock3 className="h-4 w-4" />}
        />
        <SummaryCard
          label="Expected now"
          value={`${formatHoursDecimal(progress.expectedBillableHours)} ${expectedBillableSpeed}`}
          helper="Expected billable time at this point in the window"
          icon={<Percent className="h-4 w-4" />}
        />
        <SummaryCard
          label="Delta"
          value={progress.deltaHours >= 0 ? `+${formatHoursDecimal(ahead)}` : `-${formatHoursDecimal(behind)}`}
          helper={progress.deltaHours >= 0 ? "Ahead of expected" : "Behind expected"}
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <SummaryCard
          label="Target window"
          value={formatHoursDecimal(targetBillableHours)}
          helper={`${settings.billingWeeklyHours.toFixed(1)}h weekly goal at ${Math.round(settings.billableTargetRate * 100)}%`}
          icon={<CalendarRange className="h-4 w-4" />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel rounded-[28px] p-6 sm:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Current window</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Start from the first session after the previous cutoff.</h2>
              <p className="mt-2 max-w-2xl text-sm text-[rgb(var(--muted))]">
                Start: {progress.startDateKey} · End: {cutoffLabel} · The expected value grows from the first logged session inside this window.
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-sm text-[rgb(var(--muted))]">
              {formatHoursOneDecimal(progress.elapsedTargetHours)} target elapsed
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--panel),0.62)] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Billable today</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{formatHoursDecimal(todaySummary.billableHours)}</p>
              <p className="mt-2 text-sm text-[rgb(var(--muted))]">Today’s rounded billable task buckets only.</p>
            </div>
            <div className="rounded-[22px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--panel),0.62)] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Today target</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{formatHoursDecimal(todaySummary.targetBillableHours)}</p>
              <p className="mt-2 text-sm text-[rgb(var(--muted))]">Daily target based on billable rate and billable work hours per day.</p>
            </div>
            <div className="rounded-[22px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--panel),0.62)] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Today vs target</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {todaySummary.isOnTarget ? `+${formatHoursDecimal(Math.abs(todaySummary.distanceToTarget))}` : `-${formatHoursDecimal(Math.abs(todaySummary.distanceToTarget))}`}
              </p>
              <p className="mt-2 text-sm text-[rgb(var(--muted))]">
                {todaySummary.isOnTarget ? "Above today's target" : "Below today's target"}
              </p>
            </div>
          </div>
        </div>

        <div className="panel rounded-[28px] p-6 sm:p-7">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Context</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Why this page matches the live score.</h2>
            <ul className="mt-4 grid gap-3 text-sm text-[rgb(var(--muted))]">
              <li>Uses the configured end day and time from Settings.</li>
              <li>Anchors the start to the first session after the previous cutoff.</li>
              <li>Compares actual rounded billable hours to expected hours at the current time.</li>
              <li>Shows today's bucket breakdown using the same rounding and exclusion rules.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden rounded-[28px]">
        <div className="border-b border-[rgb(var(--line))] bg-[rgba(var(--accent),0.05)] px-5 py-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--muted))]">Today buckets</h2>
        </div>
        {todaySummary.entries.length === 0 ? (
          <div className="px-5 py-8 text-sm text-[rgb(var(--muted))]">No billable time recorded for today.</div>
        ) : (
          <table className="min-w-full divide-y divide-[rgb(var(--line))] text-left text-sm">
            <thead className="bg-[rgba(var(--panel),0.35)] text-[rgb(var(--muted))]">
              <tr>
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Task</th>
                <th className="px-5 py-3 font-medium text-right">Raw</th>
                <th className="px-5 py-3 font-medium text-right">Rounded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--line))] bg-[rgba(var(--panel),0.4)]">
              {todaySummary.entries.map((entry) => (
                <tr key={`${entry.project}::${entry.task}`}>
                  <td className="px-5 py-3.5 font-medium text-white">{entry.project}</td>
                  <td className="px-5 py-3.5 text-[rgb(var(--muted))]">{entry.task}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums">{formatHoursOneDecimal(entry.rawHours)}</td>
                  <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{formatHoursDecimal(entry.roundedHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--panel),0.64)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[rgb(var(--muted))]">{label}</p>
        <span className="text-[rgb(var(--muted))]">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-[rgb(var(--muted))]">{helper}</p>
    </div>
  );
}
