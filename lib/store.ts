"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  AppData,
  FocusSession,
  PlanItem,
  Project,
  Task,
  TimerMode,
  TimerSettings,
  defaultAppData,
} from "@/lib/domain";
import { appRepository } from "@/lib/repository";
import { getTodayStats } from "@/lib/analytics";
import { getDateKey, uid } from "@/lib/utils";

type TimerRuntime = {
  mode: TimerMode;
  remainingSec: number;
  isRunning: boolean;
  startedAt: string | null;
  cycleCount: number;
  activeSessionId: string | null;
};

type AppState = AppData & {
  hydrated: boolean;
  todayKey: string;
  timer: TimerRuntime;
  load: () => void;
  syncWithCloud: (userId: string) => Promise<void>;
  syncTheme: () => void;
  setMode: (mode: TimerMode) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  skipTimer: () => FocusSession | null;
  tick: () => FocusSession | null;
  addProject: (title: string) => string;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  setActiveProject: (projectId: string | null) => void;
  addTask: (projectId: string, title: string, estimatePomodoros: number) => string;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  setActiveTask: (taskId: string | null) => void;
  reorderTask: (taskId: string, direction: "up" | "down") => void;
  addPlanItem: (title: string, priority: PlanItem["priority"], linkedTaskId?: string | null) => void;
  updatePlanItem: (id: string, updates: Partial<PlanItem>) => void;
  deletePlanItem: (id: string) => void;
  addSession: (session: Omit<FocusSession, "id">) => void;
  updateSession: (id: string, updates: Partial<FocusSession>) => void;
  deleteSession: (id: string) => void;
  addSessionNote: (content: string) => void;
  addDistraction: (content: string) => void;
  resolveDistraction: (id: string) => void;
  convertDistractionToTask: (id: string) => void;
  updateSettings: (updates: Partial<TimerSettings>) => void;
  getTodayStats: () => ReturnType<typeof getTodayStats>;
};

function modeDurationSec(settings: TimerSettings, mode: TimerMode) {
  if (mode === "focus") {
    return settings.focusMinutes * 60;
  }
  if (mode === "shortBreak") {
    return settings.shortBreakMinutes * 60;
  }
  return settings.longBreakMinutes * 60;
}

function normalizeOrder<T extends { order: number }>(items: T[]) {
  return items.map((item, index) => ({ ...item, order: index }));
}

function getNextMode(current: TimerMode, cycleCount: number, settings: TimerSettings): TimerMode {
  if (current === "focus") {
    return cycleCount % settings.longBreakEvery === 0 ? "longBreak" : "shortBreak";
  }
  return "focus";
}

function getElapsedSeconds(startedAt: string | null, endedAtMs = Date.now()) {
  if (!startedAt) {
    return 0;
  }

  const startedAtMs = Date.parse(startedAt);
  if (Number.isNaN(startedAtMs)) {
    return 0;
  }

  return Math.max(Math.floor((endedAtMs - startedAtMs) / 1000), 0);
}

function buildSessionFragment(state: AppState, endedAt = new Date().toISOString()) {
  if (!state.timer.startedAt) {
    return null;
  }

  const endedAtMs = Date.parse(endedAt);
  const plannedDurationSec = modeDurationSec(state.settings, state.timer.mode);
  const actualDurationSec = Math.min(plannedDurationSec, getElapsedSeconds(state.timer.startedAt, Number.isNaN(endedAtMs) ? Date.now() : endedAtMs));
  return {
    id: state.timer.activeSessionId ?? uid("session"),
    mode: state.timer.mode,
    projectId: state.activeProjectId,
    taskId: state.activeTaskId,
    startedAt: state.timer.startedAt,
    endedAt,
    plannedDurationSec,
    actualDurationSec,
    completed: false,
    interrupted: true,
  } satisfies FocusSession;
}

function currentRemainingSec(state: AppState) {
  if (!state.timer.isRunning || !state.timer.startedAt) {
    return state.timer.remainingSec;
  }

  const elapsedSec = getElapsedSeconds(state.timer.startedAt);
  return Math.max(state.timer.remainingSec - elapsedSec, 0);
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    ...defaultAppData,
    hydrated: false,
    todayKey: getDateKey(),
    timer: {
      mode: "focus",
      remainingSec: defaultAppData.settings.focusMinutes * 60,
      isRunning: false,
      startedAt: null,
      cycleCount: 0,
      activeSessionId: null,
    },
    load: () => {
      const data = appRepository.load();
      set({
        ...data,
        hydrated: true,
        todayKey: getDateKey(),
        timer: {
          mode: "focus",
          remainingSec: modeDurationSec(data.settings, "focus"),
          isRunning: false,
          startedAt: null,
          cycleCount: getTodayStats(data.sessions, data.tasks, data.plansByDate[getDateKey()] ?? []).completedSessions,
          activeSessionId: null,
        },
      });
      get().syncTheme();
    },
    syncWithCloud: async (userId) => {
      const result = await appRepository.syncWithCloud(userId);
      if (result) {
        set({ sessions: result.sessions });
      }
    },
    syncTheme: () => {
      if (typeof document === "undefined") {
        return;
      }

      const theme = get().settings.theme;
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && prefersDark));
    },
    setMode: (mode) =>
      set((state) => {
        const fragment = buildSessionFragment(state);
        return {
          ...(fragment ? { sessions: [...state.sessions, fragment] } : null),
          timer: {
            ...state.timer,
            mode,
            isRunning: false,
            remainingSec: modeDurationSec(state.settings, mode),
            startedAt: null,
            activeSessionId: null,
          },
        };
      }),
    startTimer: () =>
      set((state) => ({
        timer: {
          ...state.timer,
          isRunning: true,
          startedAt: state.timer.startedAt ?? new Date().toISOString(),
          activeSessionId: state.timer.activeSessionId ?? uid("session"),
        },
      })),
    pauseTimer: () =>
      set((state) => {
        const fragment = buildSessionFragment(state);
        return {
          ...(fragment ? { sessions: [...state.sessions, fragment] } : null),
          timer: {
            ...state.timer,
            isRunning: false,
            remainingSec: currentRemainingSec(state),
            startedAt: null,
            activeSessionId: null,
          },
        };
      }),
    resetTimer: () =>
      set((state) => {
        const fragment = buildSessionFragment(state);
        return {
          ...(fragment ? { sessions: [...state.sessions, fragment] } : null),
          timer: {
            ...state.timer,
            remainingSec: modeDurationSec(state.settings, state.timer.mode),
            isRunning: false,
            startedAt: null,
            activeSessionId: null,
          },
        };
      }),
    skipTimer: () => {
      const state = get();
      const { timer, settings } = state;
      const session = buildSessionFragment(state);

      if (session) {
        set((current) => ({
          sessions: [...current.sessions, session],
        }));
      }

      const cycleCount = timer.mode === "focus" ? state.timer.cycleCount + 1 : state.timer.cycleCount;
      const nextMode = getNextMode(timer.mode, cycleCount, settings);
      set({
        timer: {
          mode: nextMode,
          remainingSec: modeDurationSec(settings, nextMode),
          isRunning: nextMode === "focus" ? settings.autoStartFocus : settings.autoStartBreaks,
          startedAt: null,
          cycleCount,
          activeSessionId: null,
        },
      });

      return session;
    },
    tick: () => {
      const state = get();
      if (!state.timer.isRunning) {
        return null;
      }

      const remainingSec = currentRemainingSec(state);
      if (remainingSec > 0) {
        // We no longer update the store every second. 
        // Components should calculate their own display time from startedAt.
        return null;
      }

      const completedSession: FocusSession = {
        id: state.timer.activeSessionId ?? uid("session"),
        mode: state.timer.mode,
        projectId: state.activeProjectId,
        taskId: state.activeTaskId,
        startedAt: state.timer.startedAt ?? new Date(Date.now() - modeDurationSec(state.settings, state.timer.mode) * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        plannedDurationSec: modeDurationSec(state.settings, state.timer.mode),
        actualDurationSec: modeDurationSec(state.settings, state.timer.mode),
        completed: true,
        interrupted: false,
      };

      const nextCycleCount = state.timer.mode === "focus" ? state.timer.cycleCount + 1 : state.timer.cycleCount;
      const nextMode = getNextMode(state.timer.mode, nextCycleCount, state.settings);
      const tasks =
        state.timer.mode === "focus" && state.activeTaskId
          ? state.tasks.map((task) =>
              task.id === state.activeTaskId
                ? {
                    ...task,
                    completedPomodoros: task.completedPomodoros + 1,
                    status: task.completedPomodoros + 1 >= task.estimatePomodoros ? "done" : task.status,
                    updatedAt: new Date().toISOString(),
                  }
                : task,
            )
          : state.tasks;

      set({
        tasks,
        sessions: [...state.sessions, completedSession],
        timer: {
          mode: nextMode,
          remainingSec: modeDurationSec(state.settings, nextMode),
          isRunning: nextMode === "focus" ? state.settings.autoStartFocus : state.settings.autoStartBreaks,
          startedAt: null,
          cycleCount: nextCycleCount,
          activeSessionId: null,
        },
      });

      return completedSession;
    },
    addProject: (title) => {
      const nextProjectId = uid("project");
      set((state) => {
        const now = new Date().toISOString();
        return {
          projects: [
            ...normalizeOrder(state.projects),
            {
              id: nextProjectId,
              title,
              order: state.projects.length,
              createdAt: now,
              updatedAt: now,
            },
          ],
          activeProjectId: nextProjectId,
          activeTaskId: null,
        };
      });
      return nextProjectId;
    },
    updateProject: (projectId, updates) =>
      set((state) => ({
        projects: state.projects.map((project) =>
          project.id === projectId ? { ...project, ...updates, updatedAt: new Date().toISOString() } : project,
        ),
      })),
    setActiveProject: (projectId) =>
      set((state) => {
        if (projectId == null) {
          return { activeProjectId: null, activeTaskId: null };
        }

        const projectExists = state.projects.some((project) => project.id === projectId);
        if (!projectExists) {
          return state;
        }

        const currentTask = state.tasks.find((task) => task.id === state.activeTaskId);
        const fragment = buildSessionFragment(state);
        const nextRemainingSec = fragment ? Math.max(currentRemainingSec(state), 0) : state.timer.remainingSec;
        const nextTaskId = currentTask?.projectId === projectId ? currentTask.id : null;
        return {
          ...(fragment ? { sessions: [...state.sessions, fragment] } : null),
          activeProjectId: projectId,
          activeTaskId: nextTaskId,
          timer: state.timer.isRunning
            ? {
                ...state.timer,
                remainingSec: nextRemainingSec,
                startedAt: new Date().toISOString(),
                activeSessionId: uid("session"),
              }
            : state.timer,
        };
      }),
    addTask: (projectId, title, estimatePomodoros) => {
      const nextTaskId = uid("task");
      set((state) => {
        const now = new Date().toISOString();
        const resolvedProjectId = state.projects.some((project) => project.id === projectId)
          ? projectId
          : state.activeProjectId ?? state.projects[0]?.id ?? null;
        return {
          tasks: [
            ...state.tasks,
            {
              id: nextTaskId,
              title,
              estimatePomodoros,
              completedPomodoros: 0,
              status: "todo",
              projectId: resolvedProjectId,
              order: state.tasks.length,
              createdAt: now,
              updatedAt: now,
            },
          ],
        };
      });
      return nextTaskId;
    },
    updateTask: (taskId, updates) =>
      set((state) => ({
        tasks: state.tasks.map((task) =>
          task.id === taskId ? { ...task, ...updates, updatedAt: new Date().toISOString() } : task,
        ),
      })),
    deleteTask: (taskId) =>
      set((state) => ({
        tasks: normalizeOrder(state.tasks.filter((task) => task.id !== taskId)),
        activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
        activeProjectId:
          state.activeTaskId === taskId ? state.activeProjectId : state.activeProjectId,
        plansByDate: Object.fromEntries(
          Object.entries(state.plansByDate).map(([date, items]) => [
            date,
            items.map((item) => (item.linkedTaskId === taskId ? { ...item, linkedTaskId: null } : item)),
          ]),
        ),
        distractionsByDate: Object.fromEntries(
          Object.entries(state.distractionsByDate).map(([date, items]) => [
            date,
            items.map((item) => (item.linkedTaskId === taskId ? { ...item, linkedTaskId: null } : item)),
          ]),
        ),
      })),
    setActiveTask: (taskId) =>
      set((state) => {
        if (taskId == null) {
          const fragment = buildSessionFragment(state);
          return {
            ...(fragment ? { sessions: [...state.sessions, fragment] } : null),
            activeTaskId: null,
            timer: state.timer.isRunning
              ? {
                  ...state.timer,
                  startedAt: fragment ? new Date().toISOString() : state.timer.startedAt,
                  activeSessionId: fragment ? uid("session") : state.timer.activeSessionId,
                }
              : state.timer,
          };
        }

        const task = state.tasks.find((entry) => entry.id === taskId);
        if (!task) {
          return state;
        }

        const fragment = buildSessionFragment(state);
        const nextRemainingSec = fragment ? Math.max(currentRemainingSec(state), 0) : state.timer.remainingSec;
        return {
          ...(fragment ? { sessions: [...state.sessions, fragment] } : null),
          activeProjectId: task.projectId ?? state.activeProjectId,
          activeTaskId: taskId,
          timer: state.timer.isRunning
            ? {
                ...state.timer,
                remainingSec: nextRemainingSec,
                startedAt: new Date().toISOString(),
                activeSessionId: uid("session"),
              }
            : state.timer,
        };
      }),
    reorderTask: (taskId, direction) =>
      set((state) => {
        const orderedTasks = [...state.tasks].sort((a, b) => a.order - b.order);
        const targetTask = orderedTasks.find((task) => task.id === taskId);
        if (!targetTask) {
          return state;
        }
        const projectTasks = orderedTasks.filter((task) => task.projectId === targetTask.projectId);
        const index = projectTasks.findIndex((task) => task.id === taskId);
        if (index < 0) {
          return state;
        }
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= projectTasks.length) {
          return state;
        }
        [projectTasks[index], projectTasks[targetIndex]] = [projectTasks[targetIndex], projectTasks[index]];
        let cursor = 0;
        const tasks = orderedTasks.map((task) => (task.projectId === targetTask.projectId ? projectTasks[cursor++] : task));
        return { tasks: normalizeOrder(tasks) };
      }),
    addPlanItem: (title, priority, linkedTaskId = null) =>
      set((state) => ({
        plansByDate: {
          ...state.plansByDate,
          [state.todayKey]: [
            ...(state.plansByDate[state.todayKey] ?? []),
            {
              id: uid("plan"),
              title,
              linkedTaskId,
              priority,
              status: "planned",
              order: (state.plansByDate[state.todayKey] ?? []).length,
            },
          ],
        },
      })),
    updatePlanItem: (id, updates) =>
      set((state) => ({
        plansByDate: {
          ...state.plansByDate,
          [state.todayKey]: (state.plansByDate[state.todayKey] ?? []).map((item) => (item.id === id ? { ...item, ...updates } : item)),
        },
      })),
    deletePlanItem: (id) =>
      set((state) => ({
        plansByDate: {
          ...state.plansByDate,
          [state.todayKey]: normalizeOrder((state.plansByDate[state.todayKey] ?? []).filter((item) => item.id !== id)),
        },
      })),
    addSession: (session) =>
      set((state) => ({
        sessions: [...state.sessions, { ...session, id: uid("session") }],
      })),
    updateSession: (id, updates) =>
      set((state) => ({
        sessions: state.sessions.map((session) => (session.id === id ? { ...session, ...updates } : session)),
      })),
    deleteSession: (id) =>
      set((state) => ({
        sessions: state.sessions.filter((session) => session.id !== id),
      })),
    addSessionNote: (content) =>
      set((state) => {
        const sessionId = state.timer.activeSessionId ?? state.sessions.at(-1)?.id;
        if (!sessionId) {
          return state;
        }
        return {
          notesBySession: {
            ...state.notesBySession,
            [sessionId]: [
              ...(state.notesBySession[sessionId] ?? []),
              {
                id: uid("note"),
                sessionId,
                content,
                createdAt: new Date().toISOString(),
              },
            ],
          },
        };
      }),
    addDistraction: (content) =>
      set((state) => ({
        distractionsByDate: {
          ...state.distractionsByDate,
          [state.todayKey]: [
            ...(state.distractionsByDate[state.todayKey] ?? []),
            {
              id: uid("distraction"),
              content,
              capturedAt: new Date().toISOString(),
              resolved: false,
              linkedTaskId: null,
            },
          ],
        },
      })),
    resolveDistraction: (id) =>
      set((state) => ({
        distractionsByDate: {
          ...state.distractionsByDate,
          [state.todayKey]: (state.distractionsByDate[state.todayKey] ?? []).map((item) =>
            item.id === id ? { ...item, resolved: !item.resolved } : item,
          ),
        },
      })),
    convertDistractionToTask: (id) =>
      set((state) => {
        const item = (state.distractionsByDate[state.todayKey] ?? []).find((entry) => entry.id === id);
        if (!item) {
          return state;
        }

        const now = new Date().toISOString();
        const projectId = state.activeProjectId ?? state.projects[0]?.id ?? null;
        const newTask: Task = {
          id: uid("task"),
          title: item.content,
          estimatePomodoros: 1,
          completedPomodoros: 0,
          status: "todo",
          projectId,
          order: state.tasks.length,
          createdAt: now,
          updatedAt: now,
        };

        return {
          tasks: [...state.tasks, newTask],
          distractionsByDate: {
            ...state.distractionsByDate,
            [state.todayKey]: (state.distractionsByDate[state.todayKey] ?? []).map((entry) =>
              entry.id === id ? { ...entry, resolved: true, linkedTaskId: newTask.id } : entry,
            ),
          },
        };
      }),
    updateSettings: (updates) =>
      set((state) => {
        const settings = { ...state.settings, ...updates };
        return {
          settings,
          timer: {
            ...state.timer,
            remainingSec: state.timer.isRunning ? state.timer.remainingSec : modeDurationSec(settings, state.timer.mode),
          },
        };
      }),
    getTodayStats: () => {
      const state = get();
      return getTodayStats(state.sessions, state.tasks, state.plansByDate[state.todayKey] ?? [], state.todayKey);
    },
  })),
);

useAppStore.subscribe(
  (state) => ({
    projects: state.projects,
    settings: state.settings,
    tasks: state.tasks,
    plansByDate: state.plansByDate,
    sessions: state.sessions,
    notesBySession: state.notesBySession,
    distractionsByDate: state.distractionsByDate,
    activeProjectId: state.activeProjectId,
    activeTaskId: state.activeTaskId,
    focusStreakDays: state.focusStreakDays,
  }),
  (data) => {
    appRepository.save(data);
  },
);
