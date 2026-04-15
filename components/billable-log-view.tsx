"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import {
  formatHoursDecimal,
  getBillableDaySummary,
  getBillableWeekSummary,
  getBillableWeekTrend,
} from "@/lib/analytics";
import { formatMinutes, getDateKey } from "@/lib/utils";
import {
  CalendarRange,
  Clock3,
  Percent,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { useSessions, useProjects } from "@/lib/hooks";
import { FocusSession } from "@/lib/domain";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function BillableLogView() {
  const { sessions } = useSessions();
  const { projects } = useProjects();
  
  const timer = useAppStore((state) => state.timer);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const activeTaskName = useAppStore((state) => state.activeTaskName);
  
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const minuteTick = useMinuteTick(timer.isRunning);
  const weekTrendTick = useMinuteTick(timer.isRunning);

  const liveSessions = useMemo(() => {
    const base = [...sessions];
    if (timer.isRunning && timer.startedAt && timer.mode === "focus") {
      const activeSession: FocusSession = {
        id: timer.activeSessionId ?? "active",
        mode: timer.mode,
        projectId: activeProject?.id ?? null,
        projectName: activeProject?.title ?? null,
        taskId: null,
        taskName: activeTaskName ?? null,
        startedAt: timer.startedAt,
        endedAt: new Date().toISOString(),
        plannedDurationSec: 0,
        actualDurationSec: Math.max(0, Math.floor((Date.now() - Date.parse(timer.startedAt)) / 1000)),
        completed: false,
        interrupted: false,
      };
      base.push(activeSession);
    }
    return base;
  }, [sessions, timer.isRunning, timer.startedAt, timer.mode, timer.activeSessionId, activeProject, activeTaskName]);

  const summary = useMemo(() => getBillableDaySummary(liveSessions, getDateKey()), [liveSessions, minuteTick]);
  const weekSummary = useMemo(
    () =>
      getBillableWeekSummary(
        liveSessions,
        getDateKey(),
        timer.isRunning && timer.startedAt && timer.mode === "focus"
          ? {
              projectName: activeProject?.title ?? null,
              taskName: activeTaskName ?? null,
              actualDurationSec: Math.max(0, Math.floor((Date.now() - Date.parse(timer.startedAt)) / 1000)),
            }
          : null,
      ),
    [activeProject?.title, activeTaskName, liveSessions, timer.isRunning, timer.mode, timer.startedAt, weekTrendTick],
  );
  const weekTrend = useMemo(() => getBillableWeekTrend(liveSessions, 8, getDateKey()), [liveSessions, weekTrendTick]);
  const targetHours = summary.targetBillableHours;
  const targetGapHours = summary.distanceToTarget;
  const weeklyTargetHours = weekSummary.targetBillableHours;
  const weeklyGapHours = weekSummary.distanceToTarget;
  const projectedWeeklyHours = weekSummary.projectedHours;
  const weeklyBillablePercentage = weekSummary.billablePercentage;
  const onTrack = projectedWeeklyHours >= weeklyTargetHours;

  return (
    <main className="flex flex-col gap-6">
      <section className="panel rounded-[28px] p-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Billable log</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Billable time, rounded per task.</h1>
            <p className="mt-2 max-w-2xl text-sm text-[rgb(var(--muted))]">
              Admin is excluded. Each project/task bucket is summed first, then rounded up to the next 0.25 hour.
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-sm text-[rgb(var(--muted))]">
            Daily + weekly
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <SummaryCard
          label="Billable today"
          value={formatHoursDecimal(summary.billableHours)}
          helper={`${summary.entries.length} billable task bucket${summary.entries.length === 1 ? "" : "s"}`}
          icon={<Clock3 className="h-4 w-4" />}
        />
        <SummaryCard
          label="Target"
          value={`${Math.round(summary.targetBillableRate * 100)}%`}
          helper={`${formatHoursDecimal(targetHours)} of an 8h day`}
          icon={<Percent className="h-4 w-4" />}
        />
        <SummaryCard
          label="Distance to target"
          value={summary.isOnTarget ? `+${formatHoursDecimal(Math.abs(targetGapHours))}` : `-${formatHoursDecimal(Math.abs(targetGapHours))}`}
          helper={summary.isOnTarget ? "Above 85% of 8h" : "Still below 85% of 8h"}
          icon={<ShieldAlert className="h-4 w-4" />}
        />
      </section>

      <section className="panel rounded-[28px] p-6 sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Weekly billable</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Saturday to Friday billing week.</h2>
            <p className="mt-2 max-w-2xl text-sm text-[rgb(var(--muted))]">
              The weekly target is 40 billable hours. Weekend time counts when it exists, and the projection shows whether
              the current pace reaches Friday on target.
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-sm text-[rgb(var(--muted))]">
            {formatBillingWeekLabel(weekSummary.startDateKey, weekSummary.endDateKey)}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Week billable"
          value={formatHoursDecimal(weekSummary.billableHours)}
          helper={`${weekSummary.daysCovered} day${weekSummary.daysCovered === 1 ? "" : "s"} covered in the current week`}
          icon={<CalendarRange className="h-4 w-4" />}
        />
        <SummaryCard
          label="Billable %"
          value={`${Math.round(weeklyBillablePercentage)}%`}
          helper={`${formatHoursDecimal(weekSummary.billableHours)} of ${formatHoursDecimal(weeklyTargetHours)}`}
          icon={<Percent className="h-4 w-4" />}
        />
        <SummaryCard
          label="Weekly target"
          value={`${formatHoursDecimal(weeklyTargetHours)}`}
          helper="40h billing goal"
          icon={<Percent className="h-4 w-4" />}
        />
        <SummaryCard
          label="Projected Friday"
          value={formatHoursDecimal(projectedWeeklyHours)}
          helper={onTrack ? "On track to clear 40h" : "Needs more billable time this week"}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="panel rounded-[28px] overflow-hidden">
          <div className="border-b border-[rgb(var(--line))] bg-[rgba(var(--accent),0.05)] px-5 py-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--muted))]">Weekly trend</h2>
          </div>
          <div className="h-[320px] px-3 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weekTrend}>
                <CartesianGrid stroke="rgba(var(--line),0.3)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "rgb(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="percent"
                  tick={{ fill: "rgb(var(--muted))", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis
                  yAxisId="hours"
                  orientation="right"
                  tick={{ fill: "rgb(var(--muted))", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => formatHoursDecimal(Number(value ?? 0))}
                />
                <Tooltip
                  contentStyle={{ background: "rgb(var(--panel))", border: "1px solid rgba(var(--line),0.6)", borderRadius: "16px" }}
                  labelStyle={{ color: "rgb(var(--text))" }}
                  formatter={(value, name) => {
                    if (name === "billablePercentage") {
                      return [`${Number(value ?? 0).toFixed(0)}%`, "Billable %"];
                    }
                    if (name === "billableHours") {
                      return [formatHoursDecimal(Number(value ?? 0)), "Billable hours"];
                    }
                    return [String(value ?? 0), String(name ?? "")];
                  }}
                />
                <Bar yAxisId="hours" dataKey="billableHours" fill="rgba(var(--accent-strong),0.55)" radius={[10, 10, 0, 0]} />
                <Line
                  yAxisId="percent"
                  type="monotone"
                  dataKey="billablePercentage"
                  stroke="rgb(var(--accent-alt))"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  yAxisId="percent"
                  type="monotone"
                  dataKey="targetBillablePercentage"
                  stroke="rgba(var(--muted),0.55)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel rounded-[28px] overflow-hidden">
          <div className="border-b border-[rgb(var(--line))] bg-[rgba(var(--accent),0.05)] px-5 py-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--muted))]">Weekly pace</h2>
          </div>
          <div className="grid gap-3 p-5 text-sm">
            <div className="rounded-[24px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--panel),0.62)] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Pace</p>
              <p className="mt-2 text-2xl font-semibold">{formatHoursDecimal(weekSummary.currentPaceHoursPerDay)} / day</p>
              <p className="mt-2 text-sm text-[rgb(var(--muted))]">
                {onTrack
                  ? `Projected ${formatHoursDecimal(projectedWeeklyHours)} by Friday, ${formatHoursDecimal(Math.abs(weeklyGapHours))} ahead of target.`
                  : `Projected ${formatHoursDecimal(projectedWeeklyHours)} by Friday, ${formatHoursDecimal(Math.abs(weeklyGapHours))} short of target.`}
              </p>
            </div>
            <div className="rounded-[24px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--panel),0.62)] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Remaining to target</p>
              <p className="mt-2 text-2xl font-semibold">{formatHoursDecimal(weekSummary.remainingHours)}</p>
              <p className="mt-2 text-sm text-[rgb(var(--muted))]">
                {weekSummary.daysRemaining} day{weekSummary.daysRemaining === 1 ? "" : "s"} left in the billing week.
              </p>
            </div>
            <div className="rounded-[24px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--panel),0.62)] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Trend</p>
              <p className="mt-2 text-2xl font-semibold">{Math.round(weekSummary.billablePercentage)}%</p>
              <p className="mt-2 text-sm text-[rgb(var(--muted))]">
                {onTrack ? "The current pace is enough to reach Friday." : "The pace needs to lift to hit the 40h goal."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden rounded-[28px]">
        <div className="border-b border-[rgb(var(--line))] bg-[rgba(var(--accent),0.05)] px-5 py-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--muted))]">Project / task buckets</h2>
        </div>
        {summary.entries.length === 0 ? (
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
              {summary.entries.map((entry) => (
                <tr key={`${entry.project}::${entry.task}`}>
                  <td className="px-5 py-3.5 font-medium text-white">{entry.project}</td>
                  <td className="px-5 py-3.5 text-[rgb(var(--muted))]">{entry.task}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums">{formatMinutes(Math.round(entry.rawHours * 60))}</td>
                  <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                    {formatHoursDecimal(entry.roundedHours)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel overflow-hidden rounded-[28px]">
        <div className="border-b border-[rgb(var(--line))] bg-[rgba(var(--accent),0.05)] px-5 py-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--muted))]">Week buckets</h2>
        </div>
        {weekSummary.entries.length === 0 ? (
          <div className="px-5 py-8 text-sm text-[rgb(var(--muted))]">No billable time recorded in the current billing week.</div>
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
              {weekSummary.entries.map((entry) => (
                <tr key={`${entry.project}::${entry.task}`}>
                  <td className="px-5 py-3.5 font-medium text-white">{entry.project}</td>
                  <td className="px-5 py-3.5 text-[rgb(var(--muted))]">{entry.task}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums">{formatMinutes(Math.round(entry.rawHours * 60))}</td>
                  <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                    {formatHoursDecimal(entry.roundedHours)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function useMinuteTick(enabled: boolean) {
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!enabled) {
      return;
    }

    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    const timeoutId = window.setTimeout(() => {
      setTick((value) => value + 1);
      intervalRef.current = window.setInterval(() => setTick((value) => value + 1), 60_000);
    }, msUntilNextMinute);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled]);

  return tick;
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
    <div className="panel rounded-[28px] p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[rgb(var(--muted))]">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-2 text-sm text-[rgb(var(--muted))]">{helper}</div>
    </div>
  );
}

function formatBillingWeekLabel(startDateKey: string, endDateKey: string) {
  const start = new Date(`${startDateKey}T00:00:00`);
  const end = new Date(`${endDateKey}T00:00:00`);
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString([], options)} - ${end.toLocaleDateString([], options)}`;
}
