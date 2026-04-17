"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { FocusSession, Project, TimerMode, TimerSettings } from "@/lib/domain";
import { playSound } from "@/lib/sound";
import { useAppStore } from "@/lib/store";
import { cn, formatDuration, getDateKey } from "@/lib/utils";
import { getSuggestedFocusTime } from "@/lib/analytics";
import { buildLiveFocusSession, getTimerRemainingSeconds, useSecondTick } from "@/lib/timer-runtime";
import { useWorkspaceStore } from "@/lib/workspace-store";

const modeLabels: Record<TimerMode, string> = {
  focus: "Focus",
};

type TimerCardProps = {
  sessions: FocusSession[];
  settings: TimerSettings;
  activeProject: Project | null;
};

export function TimerCard({ sessions, settings, activeProject }: TimerCardProps) {
  const timer = useAppStore((state) => state.timer);
  const activeTaskName = useAppStore((state) => state.activeTaskName);
  const startTimer = useAppStore((state) => state.startTimer);
  const pauseTimer = useAppStore((state) => state.pauseTimer);
  const resetTimer = useAppStore((state) => state.resetTimer);
  const addSession = useWorkspaceStore((state) => state.addSession);
  const secondTick = useSecondTick(timer.isRunning);

  const [displaySec, setDisplaySec] = useState(timer.remainingSec);
  const liveSessions = useMemo(() => {
    const activeSession = buildLiveFocusSession(timer, activeProject, activeTaskName);
    return activeSession ? [...sessions, activeSession] : sessions;
  }, [sessions, timer, activeProject, activeTaskName, secondTick]);
  const suggestion = useMemo(
    () => getSuggestedFocusTime(liveSessions, getDateKey(), settings.dailyWorkHours),
    [liveSessions, settings.dailyWorkHours],
  );

  useEffect(() => {
    if (!timer.isRunning) {
      setDisplaySec(timer.remainingSec);
    }
  }, [timer.isRunning, timer.remainingSec]);

  useEffect(() => {
    if (!timer.isRunning || !timer.startedAt) {
      return;
    }

    const interval = setInterval(() => {
      setDisplaySec(getTimerRemainingSeconds(timer));
    }, 1000);

    return () => clearInterval(interval);
  }, [timer.isRunning, timer.startedAt, timer.remainingSec]);

  const handlePause = async () => {
    const session = pauseTimer(settings);
    if (session) await addSession(session);
    if (settings.soundEnabled) void playSound(settings.soundType, "stop");
  };

  const handleReset = async () => {
    const session = resetTimer(settings);
    if (session) await addSession(session);
    if (settings.soundEnabled) void playSound(settings.soundType, "stop");
  };

  const handleStart = () => {
    startTimer();
    if (settings.soundEnabled) void playSound(settings.soundType, "start");
  };

  const modeGlow: Record<TimerMode, string> = {
    focus: "border-[rgba(var(--accent),0.22)] shadow-[0_0_0_1px_rgba(var(--accent),0.08),0_40px_120px_rgba(0,0,0,0.2)]",
  };

  return (
    <section className={cn(
      "panel relative overflow-hidden rounded-[30px] border p-6 sm:p-8 transition-all duration-500",
      modeGlow[timer.mode]
    )}>
      <div className="relative z-10 flex flex-col items-center">
        <div className="rounded-full border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg-secondary),0.55)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[rgb(var(--muted))]">
          {modeLabels.focus}
        </div>

        <div className="mt-10 text-center">
          <h2 className="text-[clamp(4.6rem,16vw,8.5rem)] font-black leading-none tracking-tight text-white">
            {formatDuration(displaySec)}
          </h2>

          <div className="mx-auto mt-4 inline-flex max-w-[34rem] flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg-secondary),0.5)] px-4 py-2 text-sm">
            <span className="font-semibold text-white">Suggested focus: {suggestion.minutes} min</span>
            <span className="text-[rgb(var(--muted))]">· {suggestion.reason}</span>
          </div>

        </div>

        <div className="mt-8 flex w-full max-w-sm flex-col items-center">
          <div className="mb-6 rounded-full border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.35)] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            {activeProject ? `${activeProject.title}${activeTaskName ? ` › ${activeTaskName}` : ""}` : "Focus block"}
          </div>

          <div className="grid grid-cols-[1fr_auto_auto] gap-3 w-full">
            <button
              type="button"
              onClick={timer.isRunning ? handlePause : handleStart}
              className={cn(
                "flex items-center justify-center gap-3 rounded-2xl px-5 py-4 text-lg font-semibold transition-all active:scale-[0.99]",
                timer.isRunning 
                  ? "bg-white text-[rgb(var(--bg))] hover:bg-neutral-100" 
                  : "bg-[rgb(var(--accent))] text-white hover:brightness-110"
              )}
            >
              {timer.isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              {timer.isRunning ? "Pause" : "Start"}
            </button>

            <button
              onClick={handleReset}
              className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.3)] p-4 text-white transition-all hover:bg-white/10"
              title="Reset"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
