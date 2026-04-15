"use client";

import { useEffect, useMemo, useState } from "react";
import { getDailyProductivity } from "@/lib/analytics";
import { useAppStore } from "@/lib/store";
import { getDateKey } from "@/lib/utils";
import { useSessions, useProjects } from "@/lib/hooks";
import { FocusSession } from "@/lib/domain";

const WORKDAY_TARGET_HOURS = 6;
const WORKWEEK_DAYS = 5;

function getWorkweekBounds(date = new Date()) {
  const start = new Date(date);
  const day = start.getDay();
  const daysSinceMonday = (day + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + (WORKWEEK_DAYS - 1));
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getRemainingWorkdays(date = new Date()) {
  const day = date.getDay();
  if (day === 0 || day === 6) {
    return 0;
  }

  return 6 - day;
}

function formatHours(value: number) {
  return `${value.toFixed(1)}h`;
}

function formatFinishAt(value: Date | null) {
  if (!value) {
    return "No pace yet";
  }

  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function StatsStrip() {
  const { sessions } = useSessions();
  const { projects } = useProjects();
  const timer = useAppStore((state) => state.timer);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const activeTaskName = useAppStore((state) => state.activeTaskName);
  
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  const [minuteTick, setMinuteTick] = useState(0);
  const [secondTick, setSecondTick] = useState(0);

  useEffect(() => {
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    let intervalId: number | null = null;
    const timeoutId = window.setTimeout(() => {
      setMinuteTick((value) => value + 1);
      intervalId = window.setInterval(() => setMinuteTick((value) => value + 1), 60_000);
    }, msUntilNextMinute);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSecondTick((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const todayKey = getDateKey();
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
  }, [
    sessions,
    timer.isRunning,
    timer.startedAt,
    timer.mode,
    timer.activeSessionId,
    activeProject,
    activeTaskName,
    secondTick,
  ]);

  const todayProductivity = useMemo(
    () => getDailyProductivity(liveSessions, todayKey),
    [liveSessions, todayKey, minuteTick, secondTick],
  );
  
  const liveScore = todayProductivity?.productivityScore ?? 0;
  const loggedHours = (todayProductivity?.workTimeSec ?? 0) / 3600;
  const now = new Date();
  const { start: workweekStart, end: workweekEnd } = getWorkweekBounds(now);
  const remainingWorkdays = getRemainingWorkdays(now);
  const weeklyTargetHours = WORKDAY_TARGET_HOURS * WORKWEEK_DAYS;
  const workweekLoggedHours = liveSessions.reduce((total, session) => {
    const startedAt = new Date(session.startedAt);
    if (Number.isNaN(startedAt.getTime())) return total;
    if (startedAt < workweekStart || startedAt > workweekEnd) return total;
    if (session.mode !== "focus") return total;
    return total + session.actualDurationSec / 3600;
  }, 0);
  const remainingWeeklyHours = Math.max(0, weeklyTargetHours - workweekLoggedHours);
  const hoursToTarget = remainingWorkdays > 0 ? remainingWeeklyHours / remainingWorkdays : null;
  const todayLoggedHours = loggedHours;
  const hoursRemainingToday = hoursToTarget == null ? null : Math.max(hoursToTarget - todayLoggedHours, 0);
  const finishAt = hoursRemainingToday == null
    ? null
    : hoursRemainingToday > 0
      ? new Date(Date.now() + hoursRemainingToday * 3600 * 1000)
      : new Date();

  const cards = useMemo(
    () => [
      {
        label: "Live score",
        value: (
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[rgba(var(--accent),0.35)] bg-[rgba(var(--accent),0.12)] text-[11px] leading-none text-[rgb(var(--accent-strong))] shadow-sm">
              ◎
            </span>
            <span>{liveScore.toFixed(1)}%</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(var(--accent),0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--accent-strong))]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[rgb(var(--accent-strong))]" />
              Live
            </span>
          </span>
        ),
      },
      {
        label: "Today",
        value:
          hoursRemainingToday == null
            ? `${formatHours(todayLoggedHours)} logged`
            : `${formatHours(todayLoggedHours)} logged · ${formatHours(hoursRemainingToday)} left`,
      },
      { label: "This week", value: `${formatHours(workweekLoggedHours)} logged` },
      {
        label: "Target pace",
        value:
          hoursToTarget == null
            ? "Weekend"
            : `${formatHours(remainingWeeklyHours)} left · ${formatHours(hoursToTarget)} / day`,
      },
      { label: "Finish by", value: hoursRemainingToday == null ? "Weekend" : hoursRemainingToday === 0 ? "Done for today" : formatFinishAt(finishAt) },
    ],
    [finishAt, hoursRemainingToday, hoursToTarget, liveScore, loggedHours, secondTick, workweekLoggedHours, todayLoggedHours],
  );

  return (
    <section className="panel rounded-[28px] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[rgb(var(--muted))]">Today at a glance</p>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">A compact read on pace, hours, and what is left for the day.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-[22px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.18)] p-4">
            <p className="text-sm text-[rgb(var(--muted))]">{card.label}</p>
            <p className="mt-3 text-xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
