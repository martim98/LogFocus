"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { CalendarRange, Clock3, Percent, ShieldAlert } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  formatBillingWeekLabel,
  formatHoursDecimal,
  getBillingCalendarSummary,
} from "@/lib/analytics";
import type { BillingCalendarRow } from "@/lib/analytics";
import { billingWeekdayOrder } from "@/lib/domain";
import { getDateKey } from "@/lib/utils";
import { useProjects, useSessions, useSettings } from "@/lib/hooks";
import { buildLiveFocusSession, useSecondTick } from "@/lib/timer-runtime";

type BillingWeekdayKey = (typeof billingWeekdayOrder)[number]["key"];

export function BillableLogView() {
  const { sessions } = useSessions();
  const { projects } = useProjects();
  const { settings, updateSettings, loading, error } = useSettings();

  const timer = useAppStore((state) => state.timer);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const activeTaskName = useAppStore((state) => state.activeTaskName);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;

  const secondTick = useSecondTick(timer.isRunning);
  const todayKey = getDateKey();

  const liveSessions = useMemo(() => {
    const activeSession = buildLiveFocusSession(timer, activeProject, activeTaskName);
    return activeSession ? [...sessions, activeSession] : sessions;
  }, [sessions, timer.isRunning, timer.startedAt, timer.mode, timer.activeSessionId, activeProject, activeTaskName, secondTick]);

  const calendar = useMemo(
    () => getBillingCalendarSummary(liveSessions, todayKey, settings.billingSchedule, settings.billableTargetRate),
    [liveSessions, todayKey, settings.billingSchedule, settings.billableTargetRate, secondTick],
  );

  const weekLabel = formatBillingWeekLabel(calendar.startDateKey, calendar.endDateKey);
  const billablePercent = calendar.currentPlannedHours > 0 ? (calendar.totalBillableHours / calendar.currentPlannedHours) * 100 : 0;

  function setWeekdayHours(weekdayKey: BillingWeekdayKey, value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;

    const rounded = Math.max(0, Math.min(24, Math.round(parsed * 4) / 4));
    void updateSettings({
      billingSchedule: {
        ...settings.billingSchedule,
        weekdayHours: {
          ...settings.billingSchedule.weekdayHours,
          [weekdayKey]: rounded,
        },
      },
    });
  }

  function setDateOverride(dateKey: string, value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;

    const rounded = Math.max(0, Math.min(24, Math.round(parsed * 4) / 4));
    void updateSettings({
      billingSchedule: {
        ...settings.billingSchedule,
        dateOverrides: {
          ...settings.billingSchedule.dateOverrides,
          [dateKey]: rounded,
        },
      },
    });
  }

  function clearDateOverride(dateKey: string) {
    const nextOverrides = { ...settings.billingSchedule.dateOverrides };
    delete nextOverrides[dateKey];
    void updateSettings({
      billingSchedule: {
        ...settings.billingSchedule,
        dateOverrides: nextOverrides,
      },
    });
  }

  if (loading) return <div>Loading billing calendar...</div>;

  return (
    <main className="flex flex-col gap-6">
      <section className="panel rounded-[28px] p-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Billing progress</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Week billing calendar with explicit carry-in.</h1>
            <p className="mt-2 max-w-2xl text-sm text-[rgb(var(--muted))]">
              Edit the weekday template, override individual dates when needed, and keep the carry-in from the previous weekend visible so the cumulative billable math stays honest.
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-sm text-[rgb(var(--muted))]">
            Week: {weekLabel}
          </div>
        </div>
        {error ? <p className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">Save failed: {error}</p> : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="Carry-in"
          value={formatHoursDecimal(calendar.carryInBillableHours)}
          helper="Weekend billable hours already counted into this week"
          icon={<Clock3 className="h-4 w-4" />}
        />
        <SummaryCard
          label="Billable now"
          value={formatHoursDecimal(calendar.totalBillableHours)}
          helper="Rounded billable hours accumulated through the current day"
          icon={<Percent className="h-4 w-4" />}
        />
        <SummaryCard
          label="Target now"
          value={formatHoursDecimal(calendar.totalTargetBillableHours)}
          helper="Expected billable hours from the editable schedule"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <SummaryCard
          label="Billable %"
          value={`${billablePercent.toFixed(1)}%`}
          helper="Share of planned hours through today"
          icon={<CalendarRange className="h-4 w-4" />}
        />
        <SummaryCard
          label="Remaining to target"
          value={formatHoursDecimal(calendar.remainingToTargetHours)}
          helper="How much more billable time is needed to hit the configured closeout target"
          icon={<Clock3 className="h-4 w-4" />}
        />
        <SummaryCard
          label="Tomorrow starts at"
          value={calendar.tomorrowStartBillableHours == null ? "Closed" : formatHoursDecimal(calendar.tomorrowStartBillableHours)}
          helper={calendar.tomorrowStartBillableHours == null ? "Final scheduled day already reached" : "Opening balance for the next day"}
          icon={<Percent className="h-4 w-4" />}
        />
      </section>

      <section className="panel rounded-[28px] p-6 sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Weekly template</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Editable weekday defaults.</h2>
            <p className="mt-2 max-w-2xl text-sm text-[rgb(var(--muted))]">
              These defaults drive the current week and any future week. A specific date override below can replace a day without changing the template.
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-sm text-[rgb(var(--muted))]">
            Closeout target is configured in settings
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {billingWeekdayOrder.map((weekday) => (
            <label key={weekday.key} className="grid gap-2 rounded-[22px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--panel),0.58)] px-4 py-4">
              <span className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">{weekday.label}</span>
              <input
                type="number"
                min="0"
                max="24"
                step="0.25"
                value={settings.billingSchedule.weekdayHours[weekday.key]}
                onChange={(event) => setWeekdayHours(weekday.key, event.currentTarget.value)}
                className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-lg font-semibold tabular-nums text-white"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="panel overflow-hidden rounded-[28px]">
        <div className="border-b border-[rgb(var(--line))] bg-[rgba(var(--accent),0.05)] px-5 py-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--muted))]">Current week</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[rgb(var(--line))] text-left text-sm">
            <thead className="bg-[rgba(var(--panel),0.35)] text-[rgb(var(--muted))]">
              <tr>
                <th className="px-5 py-3 font-medium">Day</th>
                <th className="px-5 py-3 font-medium text-right">Planned</th>
                <th className="px-5 py-3 font-medium text-right">Billable</th>
                <th className="px-5 py-3 font-medium text-right">Opening</th>
                <th className="px-5 py-3 font-medium text-right">Closing</th>
                <th className="px-5 py-3 font-medium text-right">Target</th>
                <th className="px-5 py-3 font-medium text-right">Remaining to target</th>
                <th className="px-5 py-3 font-medium text-right">Billable % of week</th>
                <th className="px-5 py-3 font-medium text-right">Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--line))] bg-[rgba(var(--panel),0.4)]">
              {calendar.rows.map((row) => (
                <CalendarRow
                  key={`${row.kind}-${row.dateKey}`}
                  row={row}
                  plannedHours={row.kind === "carryIn" ? 0 : settings.billingSchedule.dateOverrides[row.dateKey] ?? settings.billingSchedule.weekdayHours[row.weekdayKey!]}
                  onPlannedHoursChange={setDateOverride}
                  onClearOverride={clearDateOverride}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function CalendarRow({
  row,
  plannedHours,
  onPlannedHoursChange,
  onClearOverride,
}: {
  row: BillingCalendarRow;
  plannedHours: number;
  onPlannedHoursChange: (dateKey: string, value: string) => void;
  onClearOverride: (dateKey: string) => void;
}) {
  const isCarryIn = row.kind === "carryIn";
  const label = isCarryIn ? "Weekend carry-in" : formatDateLabel(row.dateKey);
  const plannedInput = isCarryIn ? "—" : plannedHours.toFixed(plannedHours % 1 === 0 ? 0 : 2);
  const billableLabel = isCarryIn || !row.isFuture ? formatHoursDecimal(row.billableHours) : "—";
  const percentLabel = row.billablePercent == null ? "—" : `${row.billablePercent.toFixed(1)}%`;
  const remainingLabel = row.remainingToTargetHours == null ? "—" : formatHoursDecimal(row.remainingToTargetHours);
  const rowClass =
    row.kind === "carryIn"
      ? "bg-[rgba(var(--accent),0.03)]"
      : row.isToday
        ? "bg-[rgba(var(--accent-strong),0.08)]"
        : row.isFuture
          ? "bg-[rgba(var(--bg),0.22)] text-[rgb(var(--muted))]"
          : "";

  return (
    <tr className={rowClass}>
      <td className="px-5 py-3.5">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-white">{label}</span>
          <span className="text-xs uppercase tracking-[0.16em] text-[rgb(var(--muted))]">
            {isCarryIn ? "Weekend before this week" : row.isFuture ? "Planned future day" : row.isToday ? "Today" : "Logged day"}
          </span>
        </div>
      </td>
      <td className="px-5 py-3.5 text-right">
        {isCarryIn ? (
          <span className="text-[rgb(var(--muted))]">—</span>
        ) : (
          <input
            type="number"
            min="0"
            max="24"
            step="0.25"
            value={plannedInput}
            onChange={(event) => onPlannedHoursChange(row.dateKey, event.currentTarget.value)}
            className="w-24 rounded-xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-3 py-2 text-right font-semibold tabular-nums text-white"
          />
        )}
      </td>
      <td className="px-5 py-3.5 text-right tabular-nums">{billableLabel}</td>
      <td className="px-5 py-3.5 text-right tabular-nums">{formatHoursDecimal(row.openingBillableHours)}</td>
      <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-white">{formatHoursDecimal(row.cumulativeBillableHours)}</td>
      <td className="px-5 py-3.5 text-right tabular-nums">{formatHoursDecimal(row.cumulativeTargetBillableHours)}</td>
      <td className="px-5 py-3.5 text-right tabular-nums">{remainingLabel}</td>
      <td className="px-5 py-3.5 text-right tabular-nums">{percentLabel}</td>
      <td className="px-5 py-3.5 text-right">
        {isCarryIn ? (
          <span className="text-xs uppercase tracking-[0.16em] text-[rgb(var(--muted))]">Locked</span>
        ) : row.isOverride ? (
          <div className="flex items-center justify-end gap-2">
            <span className="rounded-full border border-[rgba(var(--accent-strong),0.35)] bg-[rgba(var(--accent-strong),0.12)] px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-[rgb(var(--accent-strong))]">
              Override
            </span>
            <button
              type="button"
              onClick={() => onClearOverride(row.dateKey)}
              className="rounded-full border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.18)] px-3 py-1 text-xs font-medium text-[rgb(var(--muted))]"
            >
              Use default
            </button>
          </div>
        ) : (
          <span className="text-xs uppercase tracking-[0.16em] text-[rgb(var(--muted))]">Default</span>
        )}
      </td>
    </tr>
  );
}

function formatDateLabel(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
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
