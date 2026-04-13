"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { TimerMode } from "@/lib/domain";
import { playSound } from "@/lib/sound";
import { useAppStore } from "@/lib/store";
import { cn, formatDuration } from "@/lib/utils";

const modeLabels: Record<TimerMode, string> = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

const modeAccent: Record<TimerMode, string> = {
  focus: "from-indigo-500/20 to-transparent",
  shortBreak: "from-emerald-500/20 to-transparent",
  longBreak: "from-sky-500/20 to-transparent",
};

export function TimerCard() {
  const timer = useAppStore((state) => state.timer);
  const settings = useAppStore((state) => state.settings);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const activeTaskId = useAppStore((state) => state.activeTaskId);
  const projects = useAppStore((state) => state.projects);
  const tasks = useAppStore((state) => state.tasks);
  const setMode = useAppStore((state) => state.setMode);
  const startTimer = useAppStore((state) => state.startTimer);
  const pauseTimer = useAppStore((state) => state.pauseTimer);
  const resetTimer = useAppStore((state) => state.resetTimer);
  const skipTimer = useAppStore((state) => state.skipTimer);
  const tick = useAppStore((state) => state.tick);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null;

  // Local state for the ticking display to avoid global re-renders
  const [displaySec, setDisplaySec] = useState(timer.remainingSec);

  // Cycle dots: how many focus sessions into the current long-break cycle
  const cyclePosition = timer.cycleCount % settings.longBreakEvery;

  // Sync displaySec with store when timer state changes significantly
  useEffect(() => {
    if (!timer.isRunning) {
      setDisplaySec(timer.remainingSec);
    }
  }, [timer.isRunning, timer.remainingSec]);

  // Local ticking effect
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
  }, [settings.focusMinutes, settings.longBreakMinutes, settings.shortBreakMinutes, timer.isRunning, timer.mode, timer.startedAt]);

  return (
    <section className={`panel overflow-hidden rounded-[22px] bg-gradient-to-b ${modeAccent[timer.mode]} p-5 sm:p-7`}>
      {/* Mode tabs */}
      <div className="flex flex-wrap justify-center gap-2">
        {(["focus", "shortBreak", "longBreak"] as TimerMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setMode(mode)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              timer.mode === mode
                ? "bg-[rgba(0,0,0,0.2)] text-white shadow-sm"
                : "bg-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.2)] hover:text-white",
            )}
          >
            {modeLabels[mode]}
          </button>
        ))}
      </div>

      {/* Countdown */}
      <div className="mt-8 flex flex-col items-center text-center">
        <h2 className="text-[clamp(4.5rem,16vw,8rem)] font-semibold leading-none tracking-tight text-white">
          {formatDuration(displaySec)}
        </h2>

        {/* Cycle dots */}
        <div className="mt-4 flex items-center gap-1.5">
          {Array.from({ length: settings.longBreakEvery }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-2 w-2 rounded-full transition",
                i < cyclePosition ? "bg-white" : "bg-[rgba(255,255,255,0.3)]",
              )}
            />
          ))}
        </div>

        {/* Active context label */}
        <p className="mt-4 text-sm font-medium text-[rgba(255,255,255,0.75)]">
          {activeProject
            ? activeTask
              ? `${activeProject.title} › ${activeTask.title}`
              : activeProject.title
            : "No project selected"}
        </p>

        {/* Controls */}
        <div className="mt-7 flex flex-col items-center gap-3 w-full max-w-xs">
          <button
            type="button"
            onClick={() => {
              if (timer.isRunning) {
                pauseTimer();
                if (settings.soundEnabled) {
                  void playSound(settings.soundType, "stop");
                }
                return;
              }

              startTimer();
              if (settings.soundEnabled) {
                void playSound(settings.soundType, "start");
              }
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-4 text-xl font-bold tracking-wide text-[rgb(var(--bg))] shadow-[0_5px_0_rgba(255,255,255,0.25)] active:shadow-none active:translate-y-1 transition"
          >
            {timer.isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            {timer.isRunning ? "Pause" : "Start"}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetTimer();
                if (settings.soundEnabled) {
                  void playSound(settings.soundType, "stop");
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[rgba(255,255,255,0.14)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[rgba(255,255,255,0.22)] transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                skipTimer();
                if (settings.soundEnabled) {
                  void playSound(settings.soundType, "stop");
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[rgba(255,255,255,0.14)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[rgba(255,255,255,0.22)] transition"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Skip
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
