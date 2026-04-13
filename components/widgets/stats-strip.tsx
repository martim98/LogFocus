"use client";

import { useMemo } from "react";
import { estimateFinishTime, getTodayStats } from "@/lib/analytics";
import { useAppStore } from "@/lib/store";

export function StatsStrip() {
  const todayKey = useAppStore((state) => state.todayKey);
  const settings = useAppStore((state) => state.settings);
  const sessions = useAppStore((state) => state.sessions);
  const tasks = useAppStore((state) => state.tasks);
  const plansByDate = useAppStore((state) => state.plansByDate);

  const stats = useMemo(() => {
    return getTodayStats(sessions, tasks, plansByDate[todayKey] ?? [], todayKey);
  }, [sessions, tasks, plansByDate, todayKey]);

  const cards = useMemo(
    () => [
      { label: "Focus today", value: stats.focusLabel },
      { label: "Logged sessions", value: String(stats.loggedSessions) },
      { label: "Plan progress", value: `${stats.donePlan}/${stats.totalPlan || 0}` },
      { label: "Tasks done", value: `${stats.tasksDone}/${stats.totalTasks || 0}` },
      {
        label: "Estimated clear point",
        value: estimateFinishTime(stats.remainingPomodoros, settings.focusMinutes, settings.shortBreakMinutes),
      },
    ],
    [settings.focusMinutes, settings.shortBreakMinutes, stats],
  );

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="panel rounded-[24px] p-4">
          <p className="text-sm text-[rgb(var(--muted))]">{card.label}</p>
          <p className="mt-3 text-xl font-semibold">{card.value}</p>
        </div>
      ))}
    </section>
  );
}
