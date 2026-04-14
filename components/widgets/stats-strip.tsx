"use client";

import { useEffect, useMemo, useState } from "react";
import { getDailyProductivity } from "@/lib/analytics";
import { useAppStore } from "@/lib/store";
import { getDateKey } from "@/lib/utils";

export function StatsStrip() {
  const sessions = useAppStore((state) => state.sessions);
  const [minuteTick, setMinuteTick] = useState(0);

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

  const todayKey = getDateKey();
  const todayProductivity = useMemo(() => getDailyProductivity(sessions, todayKey), [sessions, todayKey, minuteTick]);
  const liveScore = todayProductivity?.productivityScore ?? 0;
  const loggedHours = (todayProductivity?.workTimeSec ?? 0) / 3600;
  const hoursToTarget = Math.max(0, 6 - loggedHours);
  const hoursNeededAtCurrentPace = liveScore > 0 ? hoursToTarget / (liveScore / 100) : null;
  const finishAt = hoursNeededAtCurrentPace == null ? null : new Date(Date.now() + hoursNeededAtCurrentPace * 3600 * 1000);

  function formatHours(value: number) {
    return `${value.toFixed(1)}h`;
  }

  function formatFinishAt(value: Date | null) {
    if (!value) {
      return "No pace yet";
    }

    return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const cards = useMemo(
    () => [
      { label: "Live score", value: `${Math.round(liveScore)}%` },
      { label: "Logged hours", value: formatHours(loggedHours) },
      { label: "To 6h", value: `${formatHours(hoursToTarget)} needed` },
      { label: "Finish by", value: formatFinishAt(finishAt) },
    ],
    [finishAt, hoursToTarget, liveScore, loggedHours],
  );

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="panel rounded-[24px] p-4">
          <p className="text-sm text-[rgb(var(--muted))]">{card.label}</p>
          <p className="mt-3 text-xl font-semibold">{card.value}</p>
        </div>
      ))}
    </section>
  );
}
