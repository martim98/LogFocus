"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { TimerMode } from "@/lib/domain";
import { playSound } from "@/lib/sound";
import { useAppStore } from "@/lib/store";
import { cn, formatDuration } from "@/lib/utils";
import { useSettings, useProjects } from "@/lib/hooks";
import { api } from "@/lib/api";

const modeLabels: Record<TimerMode, string> = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

export function TimerCard() {
  const { settings } = useSettings();
  const { projects } = useProjects();

  const timer = useAppStore((state) => state.timer);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const activeTaskName = useAppStore((state) => state.activeTaskName);

  const setMode = useAppStore((state) => state.setMode);
  const startTimer = useAppStore((state) => state.startTimer);
  const pauseTimer = useAppStore((state) => state.pauseTimer);
  const resetTimer = useAppStore((state) => state.resetTimer);
  const skipTimer = useAppStore((state) => state.skipTimer);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  const [displaySec, setDisplaySec] = useState(timer.remainingSec);
  const cyclePosition = timer.cycleCount % settings.longBreakEvery;

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
      const startedAtMs = Date.parse(timer.startedAt!);
      const elapsedSec = Math.floor((Date.now() - startedAtMs) / 1000);
      setDisplaySec(Math.max(timer.remainingSec - elapsedSec, 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [timer.isRunning, timer.startedAt, timer.remainingSec]);

  const handlePause = async () => {
    const session = pauseTimer(settings);
    if (session) await api.sessions.upsert(session);
    if (settings.soundEnabled) void playSound(settings.soundType, "stop");
  };

  const handleReset = async () => {
    const session = resetTimer(settings);
    if (session) await api.sessions.upsert(session);
    if (settings.soundEnabled) void playSound(settings.soundType, "stop");
  };

  const handleSkip = async () => {
    const session = skipTimer(settings);
    if (session) await api.sessions.upsert(session);
    if (settings.soundEnabled) void playSound(settings.soundType, "stop");
  };

  const handleStart = () => {
    startTimer();
    if (settings.soundEnabled) void playSound(settings.soundType, "start");
  };

  const modeGlow: Record<TimerMode, string> = {
    focus: "border-[rgba(var(--accent),0.22)]",
    shortBreak: "border-[rgba(var(--accent-alt),0.18)]",
    longBreak: "border-[rgba(167,139,250,0.18)]",
  };

  return (
    <section className={cn(
      "panel relative overflow-hidden rounded-[30px] border p-6 sm:p-8 transition-all duration-500",
      modeGlow[timer.mode]
    )}>
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg-secondary),0.55)] p-1">
          {(["focus", "shortBreak", "longBreak"] as TimerMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMode(mode, settings)}
              className={cn(
                "rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-all",
                timer.mode === mode
                  ? "bg-[rgba(var(--accent),0.2)] text-white"
                  : "text-[rgb(var(--muted))] hover:bg-white/5 hover:text-white"
              )}
            >
              {modeLabels[mode].split(' ')[0]}
            </button>
          ))}
        </div>

        <div className="mt-10 text-center">
          <h2 className="text-[clamp(4.6rem,16vw,8.5rem)] font-black leading-none tracking-tight text-white">
            {formatDuration(displaySec)}
          </h2>

          <div className="mt-4 flex items-center justify-center gap-2">
            {Array.from({ length: settings.longBreakEvery }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 w-6 rounded-full transition-all duration-500",
                  i < cyclePosition ? "bg-[rgb(var(--accent))]" : "bg-[rgba(var(--line),0.5)]"
                )}
              />
            ))}
          </div>
        </div>

        <div className="mt-8 flex w-full max-w-sm flex-col items-center">
          <div className="mb-6 rounded-full border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.35)] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            {activeProject ? `${activeProject.title}${activeTaskName ? ` › ${activeTaskName}` : ""}` : "Deep Work Phase"}
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

            <button
              onClick={handleSkip}
              className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.3)] p-4 text-white transition-all hover:bg-white/10"
              title="Skip"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
