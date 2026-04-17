"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { FocusSession, TimerMode, TimerSettings } from "@/lib/domain";
import { uid } from "@/lib/utils";

type TimerRuntime = {
  mode: TimerMode;
  remainingSec: number;
  isRunning: boolean;
  startedAt: string | null;
  cycleCount: number;
  activeSessionId: string | null;
};

type AppState = {
  // Transient UI State
  activeProjectId: string | null;
  activeTaskId: string | null;
  activeTaskName: string | null;
  
  // Timer State
  timer: TimerRuntime;

  // Actions
  setActiveProject: (projectId: string | null) => void;
  setActiveTask: (taskId: string | null, taskName: string | null, settings?: TimerSettings) => FocusSession | null;
  setMode: (mode: TimerMode, settings: TimerSettings) => void;
  startTimer: () => void;
  pauseTimer: (settings: TimerSettings) => FocusSession | null;
  resetTimer: (settings: TimerSettings) => FocusSession | null;
  skipTimer: (settings: TimerSettings) => FocusSession | null;
  completeTimer: (settings: TimerSettings) => FocusSession;
};

function modeDurationSec(settings: TimerSettings, mode: TimerMode) {
  if (mode === "focus") return settings.focusMinutes * 60;
  return settings.focusMinutes * 60;
}

function getElapsedSeconds(startedAt: string | null, endedAtMs = Date.now()) {
  if (!startedAt) return 0;
  const startedAtMs = Date.parse(startedAt);
  if (Number.isNaN(startedAtMs)) return 0;
  return Math.max(Math.floor((endedAtMs - startedAtMs) / 1000), 0);
}

function buildSessionFragment(state: AppState, settings: TimerSettings, endedAt = new Date().toISOString()) {
  if (!state.timer.startedAt) return null;

  const plannedDurationSec = modeDurationSec(settings, state.timer.mode);
  const actualDurationSec = Math.min(plannedDurationSec, getElapsedSeconds(state.timer.startedAt, Date.parse(endedAt)));
  
  return {
    id: state.timer.activeSessionId ?? uid("session"),
    mode: state.timer.mode,
    projectId: state.activeProjectId,
    projectName: null, // UI will fill this if needed or we keep it null
    taskId: state.activeTaskId,
    taskName: state.activeTaskName,
    startedAt: state.timer.startedAt,
    endedAt,
    plannedDurationSec,
    actualDurationSec,
    completed: false,
    interrupted: true,
  } satisfies FocusSession;
}

function normalizeTaskName(taskName: string | null) {
  const trimmed = taskName?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    activeProjectId: null,
    activeTaskId: null,
    activeTaskName: null,
    timer: {
      mode: "focus",
      remainingSec: 25 * 60,
      isRunning: false,
      startedAt: null,
      cycleCount: 0,
      activeSessionId: null,
    },

    setActiveProject: (projectId) => set({ activeProjectId: projectId }),
    setActiveTask: (taskId, taskName, settings) => {
      const state = get();
      const nextTaskName = normalizeTaskName(taskName);
      const currentTaskName = normalizeTaskName(state.activeTaskName);
      const taskChanged = state.activeTaskId !== taskId || currentTaskName !== nextTaskName;

      if (settings && state.timer.isRunning && state.timer.mode === "focus" && state.timer.startedAt && taskChanged) {
        const endedAt = new Date().toISOString();
        const session = buildSessionFragment(state, settings, endedAt);
        const elapsed = session ? session.actualDurationSec : getElapsedSeconds(state.timer.startedAt, Date.parse(endedAt));

        set({
          activeTaskId: taskId,
          activeTaskName: nextTaskName,
          timer: {
            ...state.timer,
            remainingSec: Math.max(state.timer.remainingSec - elapsed, 0),
            startedAt: endedAt,
            activeSessionId: uid("session"),
          },
        });

        return session;
      }

      set({ activeTaskId: taskId, activeTaskName: nextTaskName });
      return null;
    },

    setMode: (mode, settings) => set((state) => ({
      timer: {
        ...state.timer,
        mode,
        isRunning: false,
        remainingSec: modeDurationSec(settings, mode),
        startedAt: null,
        activeSessionId: null,
      },
    })),

    startTimer: () => set((state) => ({
      timer: {
        ...state.timer,
        isRunning: true,
        startedAt: state.timer.startedAt ?? new Date().toISOString(),
        activeSessionId: state.timer.activeSessionId ?? uid("session"),
      },
    })),

    pauseTimer: (settings) => {
      const state = get();
      const session = buildSessionFragment(state, settings);
      const elapsed = getElapsedSeconds(state.timer.startedAt);
      
      set((state) => ({
        timer: {
          ...state.timer,
          isRunning: false,
          remainingSec: Math.max(state.timer.remainingSec - elapsed, 0),
          startedAt: null,
          activeSessionId: null,
        },
      }));
      return session;
    },

    resetTimer: (settings) => {
      const state = get();
      const session = buildSessionFragment(state, settings);
      
      set((state) => ({
        timer: {
          ...state.timer,
          remainingSec: modeDurationSec(settings, state.timer.mode),
          isRunning: false,
          startedAt: null,
          activeSessionId: null,
        },
      }));
      return session;
    },

    skipTimer: (settings) => {
      const state = get();
      const session = buildSessionFragment(state, settings);

      set({
        timer: {
          mode: "focus",
          remainingSec: modeDurationSec(settings, "focus"),
          isRunning: settings.autoStartFocus,
          startedAt: null,
          cycleCount: state.timer.cycleCount + 1,
          activeSessionId: null,
        },
      });
      return session;
    },

    completeTimer: (settings) => {
      const state = get();
      const duration = modeDurationSec(settings, state.timer.mode);
      const session: FocusSession = {
        id: state.timer.activeSessionId ?? uid("session"),
        mode: state.timer.mode,
        projectId: state.activeProjectId,
        projectName: null,
        taskId: state.activeTaskId,
        taskName: state.activeTaskName,
        startedAt: state.timer.startedAt ?? new Date(Date.now() - duration * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        plannedDurationSec: duration,
        actualDurationSec: duration,
        completed: true,
        interrupted: false,
      };

      set({
        timer: {
          mode: "focus",
          remainingSec: modeDurationSec(settings, "focus"),
          isRunning: settings.autoStartFocus,
          startedAt: null,
          cycleCount: state.timer.cycleCount + 1,
          activeSessionId: null,
        },
      });

      return session;
    },
  })),
);
