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

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null;

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

  // Distinct Background behavior
  const modeGlow: Record<TimerMode, string> = {
    focus: "shadow-[0_0_50px_-12px_rgba(16,185,129,0.25)] border-[rgba(16,185,129,0.2)]",
    shortBreak: "shadow-[0_0_50px_-12px_rgba(14,165,233,0.25)] border-[rgba(14,165,233,0.2)]",
    longBreak: "shadow-[0_0_50px_-12px_rgba(139,92,246,0.25)] border-[rgba(139,92,246,0.2)]",
  };

  return (
    <section className={cn(
      "panel relative overflow-hidden rounded-[32px] p-8 transition-all duration-700 border-2",
      modeGlow[timer.mode]
    )}>
      <div className="relative z-10 flex flex-col items-center">
        {/* Modern Mode Switcher - Pill style */}
        <div className="flex p-1.5 bg-[rgba(var(--bg),0.4)] backdrop-blur-md rounded-2xl border border-[rgba(var(--line),0.3)]">
          {(["focus", "shortBreak", "longBreak"] as TimerMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMode(mode)}
              className={cn(
                "px-5 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all",
                timer.mode === mode
                  ? "bg-[rgb(var(--accent))] text-white shadow-lg"
                  : "text-[rgb(var(--muted))] hover:text-white hover:bg-white/5"
              )}
            >
              {modeLabels[mode].split(' ')[0]}
            </button>
          ))}
        </div>

        {/* High-Impact Timer Display */}
        <div className="mt-10 mb-6 text-center">
          <h2 className="text-[clamp(5rem,18vw,9rem)] font-black leading-none tracking-tightest text-white drop-shadow-2xl">
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

        <div className="flex flex-col items-center w-full max-w-sm">
           {/* Context Label */}
           <div className="mb-8 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            {activeProject ? `${activeProject.title} ${activeTask ? `› ${activeTask.title}` : ''}` : "Deep Work Phase"}
          </div>

          {/* Primary Action */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 w-full">
            <button
              type="button"
              onClick={() => {
                if (timer.isRunning) {
                  pauseTimer();
                  if (settings.soundEnabled) void playSound(settings.soundType, "stop");
                } else {
                  startTimer();
                  if (settings.soundEnabled) void playSound(settings.soundType, "start");
                }
              }}
              className={cn(
                "flex items-center justify-center gap-3 py-5 rounded-2xl text-xl font-black uppercase tracking-tighter transition-all active:scale-95 shadow-xl",
                timer.isRunning 
                  ? "bg-white text-[rgb(var(--bg))] hover:bg-neutral-100" 
                  : "bg-[rgb(var(--accent))] text-white hover:brightness-110"
              )}
            >
              {timer.isRunning ? <Pause className="fill-current h-6 w-6" /> : <Play className="fill-current h-6 w-6" />}
              {timer.isRunning ? "Hold" : "Start Focus"}
            </button>

            <button
              onClick={() => { resetTimer(); if (settings.soundEnabled) void playSound(settings.soundType, "stop"); }}
              className="p-5 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
              title="Reset"
            >
              <RotateCcw className="h-6 w-6" />
            </button>

            <button
              onClick={() => { skipTimer(); if (settings.soundEnabled) void playSound(settings.soundType, "stop"); }}
              className="p-5 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
              title="Skip"
            >
              <SkipForward className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Aesthetic Accents - Not in Pomofocus */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[rgb(var(--accent))] to-transparent opacity-30" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[rgb(var(--accent))] rounded-full blur-[120px] opacity-10 pointer-events-none" />
    </section>
  );
}
