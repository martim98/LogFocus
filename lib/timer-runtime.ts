"use client";

import { useEffect, useRef, useState } from "react";
import type { FocusSession, Project } from "@/lib/domain";

type TimerRuntime = {
  mode: "focus";
  remainingSec: number;
  isRunning: boolean;
  startedAt: string | null;
  cycleCount: number;
  activeSessionId: string | null;
};

export function getTimerRemainingSeconds(timer: TimerRuntime, nowMs = Date.now()) {
  if (!timer.isRunning || !timer.startedAt) {
    return timer.remainingSec;
  }

  const startedAtMs = Date.parse(timer.startedAt);
  if (Number.isNaN(startedAtMs)) {
    return timer.remainingSec;
  }

  const elapsedSec = Math.floor((nowMs - startedAtMs) / 1000);
  return Math.max(timer.remainingSec - elapsedSec, 0);
}

export function buildLiveFocusSession(
  timer: TimerRuntime,
  activeProject: Project | null,
  activeTaskName: string | null,
  nowIso = new Date().toISOString(),
): FocusSession | null {
  if (!timer.isRunning || !timer.startedAt || timer.mode !== "focus") {
    return null;
  }

  return {
    id: timer.activeSessionId ?? "active",
    mode: timer.mode,
    projectId: activeProject?.id ?? null,
    projectName: activeProject?.title ?? null,
    taskId: null,
    taskName: activeTaskName ?? null,
    startedAt: timer.startedAt,
    endedAt: nowIso,
    plannedDurationSec: 0,
    actualDurationSec: Math.max(0, Math.floor((Date.parse(nowIso) - Date.parse(timer.startedAt)) / 1000)),
    completed: false,
    interrupted: false,
  };
}

export function useSecondTick(enabled: boolean) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [enabled]);

  return tick;
}

export function useMinuteTick(enabled: boolean) {
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
