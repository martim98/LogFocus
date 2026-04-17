"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import {
  defaultProject,
  defaultSettings,
} from "@/lib/domain";
import type { FocusSession, PlanItem, Project, Task, TimerSettings, TodoItem } from "@/lib/domain";

type CollectionKey = "projects" | "tasks" | "todoItems" | "sessions";
type PlanDateMap = Record<string, PlanItem[] | undefined>;
type LoadingState = {
  projects: boolean;
  tasks: boolean;
  todoItems: boolean;
  sessions: boolean;
  settings: boolean;
  plans: Record<string, boolean | undefined>;
};
type ErrorState = {
  projects: string | null;
  tasks: string | null;
  todoItems: string | null;
  sessions: string | null;
  settings: string | null;
  plans: Record<string, string | null | undefined>;
};

type WorkspaceState = {
  projects: Project[];
  tasks: Task[];
  todoItems: TodoItem[];
  sessions: FocusSession[];
  settings: TimerSettings;
  plansByDate: PlanDateMap;
  loading: LoadingState;
  error: ErrorState;
  loaded: {
    projects: boolean;
    tasks: boolean;
    todoItems: boolean;
    sessions: boolean;
    settings: boolean;
    plans: Record<string, boolean | undefined>;
  };
  ensureProjects: () => Promise<void>;
  ensureTasks: () => Promise<void>;
  ensureTodoItems: () => Promise<void>;
  ensureSessions: (range?: { start: string; end: string }) => Promise<void>;
  ensureSettings: () => Promise<void>;
  ensurePlans: (date: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshTodoItems: () => Promise<void>;
  refreshSessions: (range?: { start: string; end: string }) => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshPlans: (date: string) => Promise<void>;
  addProject: (title: string) => Promise<string | undefined>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
  addTask: (task: Pick<Task, "project" | "title" | "hours" | "urgency">) => Promise<string | undefined>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<boolean>;
  deleteTask: (id: string) => Promise<boolean>;
  addTodoItem: (todoItem: Pick<TodoItem, "project" | "title" | "hours" | "urgency">) => Promise<string | undefined>;
  updateTodoItem: (id: string, updates: Partial<TodoItem>) => Promise<boolean>;
  deleteTodoItem: (id: string) => Promise<boolean>;
  addPlanItem: (date: string, title: string, priority: PlanItem["priority"], linkedTaskId?: string | null) => Promise<boolean>;
  updatePlanItem: (date: string, id: string, updates: Partial<PlanItem>) => Promise<boolean>;
  deletePlanItem: (date: string, id: string) => Promise<boolean>;
  updateSettings: (updates: Partial<TimerSettings>) => Promise<boolean>;
  addSession: (session: FocusSession) => Promise<string | undefined>;
  deleteSession: (id: string) => Promise<boolean>;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function withTimestamp<T extends { createdAt: string; updatedAt: string }>(item: Omit<T, "createdAt" | "updatedAt">, createdAt?: string): T {
  const now = new Date().toISOString();
  return {
    ...item,
    createdAt: createdAt ?? now,
    updatedAt: now,
  } as T;
}

async function applyCollectionMutation<T>({
  key,
  previous,
  next,
  commit,
  rollbackMessage,
}: {
  key: CollectionKey;
  previous: T[];
  next: T[];
  commit: () => Promise<void>;
  rollbackMessage: string;
}) {
  useWorkspaceStore.setState((state) => ({
    ...state,
    [key]: next,
    error: { ...state.error, [key]: null },
  }));

  try {
    await commit();
    return true;
  } catch (error) {
    useWorkspaceStore.setState((state) => ({
      ...state,
      [key]: previous,
      error: { ...state.error, [key]: getErrorMessage(error, rollbackMessage) },
    }));
    return false;
  }
}

async function applyPlanMutation({
  date,
  previous,
  next,
  commit,
  rollbackMessage,
}: {
  date: string;
  previous: PlanItem[];
  next: PlanItem[];
  commit: () => Promise<void>;
  rollbackMessage: string;
}) {
  useWorkspaceStore.setState((state) => ({
    plansByDate: { ...state.plansByDate, [date]: next },
    error: { ...state.error, plans: { ...state.error.plans, [date]: null } },
  }));

  try {
    await commit();
    return true;
  } catch (error) {
    useWorkspaceStore.setState((state) => ({
      plansByDate: { ...state.plansByDate, [date]: previous },
      error: { ...state.error, plans: { ...state.error.plans, [date]: getErrorMessage(error, rollbackMessage) } },
    }));
    return false;
  }
}

async function fetchResource<K extends CollectionKey | "settings">(
  key: K,
  fetcher: () => Promise<K extends "projects" ? Project[] : K extends "tasks" ? Task[] : K extends "todoItems" ? TodoItem[] : K extends "sessions" ? FocusSession[] : TimerSettings>,
) {
  useWorkspaceStore.setState((state) => ({
    loading: { ...state.loading, [key]: true },
    error: { ...state.error, [key]: null },
  }));

  try {
    const data = await fetcher();
    useWorkspaceStore.setState((state) => ({
      ...(key === "settings"
        ? { settings: data as TimerSettings }
        : { [key]: data }),
      loading: { ...state.loading, [key]: false },
      loaded: { ...state.loaded, [key]: true },
    }));
  } catch (error) {
    useWorkspaceStore.setState((state) => ({
      loading: { ...state.loading, [key]: false },
      error: { ...state.error, [key]: getErrorMessage(error, `Failed to fetch ${key}.`) },
    }));
  }
}

async function fetchPlans(date: string) {
  useWorkspaceStore.setState((state) => ({
    loading: { ...state.loading, plans: { ...state.loading.plans, [date]: true } },
    error: { ...state.error, plans: { ...state.error.plans, [date]: null } },
  }));

  try {
    const data = await api.plans.list(date);
    useWorkspaceStore.setState((state) => ({
      plansByDate: { ...state.plansByDate, [date]: data },
      loading: { ...state.loading, plans: { ...state.loading.plans, [date]: false } },
      loaded: { ...state.loaded, plans: { ...state.loaded.plans, [date]: true } },
    }));
  } catch (error) {
    useWorkspaceStore.setState((state) => ({
      loading: { ...state.loading, plans: { ...state.loading.plans, [date]: false } },
      error: { ...state.error, plans: { ...state.error.plans, [date]: getErrorMessage(error, "Failed to fetch plans.") } },
    }));
  }
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  projects: [],
  tasks: [],
  todoItems: [],
  sessions: [],
  settings: defaultSettings,
  plansByDate: {},
  loading: {
    projects: false,
    tasks: false,
    todoItems: false,
    sessions: false,
    settings: false,
    plans: {},
  },
  error: {
    projects: null,
    tasks: null,
    todoItems: null,
    sessions: null,
    settings: null,
    plans: {},
  },
  loaded: {
    projects: false,
    tasks: false,
    todoItems: false,
    sessions: false,
    settings: false,
    plans: {},
  },

  ensureProjects: async () => {
    if (!get().loaded.projects && !get().loading.projects) {
      await get().refreshProjects();
    }
  },
  ensureTasks: async () => {
    if (!get().loaded.tasks && !get().loading.tasks) {
      await get().refreshTasks();
    }
  },
  ensureTodoItems: async () => {
    if (!get().loaded.todoItems && !get().loading.todoItems) {
      await get().refreshTodoItems();
    }
  },
  ensureSessions: async () => {
    if (!get().loaded.sessions && !get().loading.sessions) {
      await get().refreshSessions();
    }
  },
  ensureSettings: async () => {
    if (!get().loaded.settings && !get().loading.settings) {
      await get().refreshSettings();
    }
  },
  ensurePlans: async (date) => {
    if (!get().loaded.plans[date] && !get().loading.plans[date]) {
      await get().refreshPlans(date);
    }
  },

  refreshProjects: async () => fetchResource("projects", async () => {
    const data = await api.projects.list();
    return data.length > 0 ? data : [defaultProject];
  }),
  refreshTasks: async () => fetchResource("tasks", () => api.tasks.list()),
  refreshTodoItems: async () => fetchResource("todoItems", () => api.todoItems.list()),
  refreshSessions: async (range) => fetchResource("sessions", () => api.sessions.list(range)),
  refreshSettings: async () => fetchResource("settings", async () => (await api.settings.get()) ?? defaultSettings),
  refreshPlans: async (date) => fetchPlans(date),

  addProject: async (title) => {
    const previous = get().projects;
    const newProject = withTimestamp<Project>({
      id: `project_${Math.random().toString(36).slice(2, 10)}`,
      title,
      order: previous.length,
    });
    const ok = await applyCollectionMutation({
      key: "projects",
      previous,
      next: [...previous, newProject],
      commit: () => api.projects.upsert(newProject).then(() => undefined),
      rollbackMessage: "Failed to save project.",
    });
    return ok ? newProject.id : undefined;
  },
  updateProject: async (id, updates) => {
    const previous = get().projects;
    const item = previous.find((project) => project.id === id);
    if (!item) return false;
    const updated = { ...item, ...updates, updatedAt: new Date().toISOString() };
    return applyCollectionMutation({
      key: "projects",
      previous,
      next: previous.map((project) => (project.id === id ? updated : project)),
      commit: () => api.projects.upsert(updated).then(() => undefined),
      rollbackMessage: "Failed to update project.",
    });
  },
  deleteProject: async (id) =>
    applyCollectionMutation({
      key: "projects",
      previous: get().projects,
      next: get().projects.filter((project) => project.id !== id),
      commit: () => api.projects.delete(id).then(() => undefined),
      rollbackMessage: "Failed to delete project.",
    }),

  addTask: async (task) => {
    const previous = get().tasks;
    const newTask = withTimestamp<Task>({
      id: `task_${Math.random().toString(36).slice(2, 10)}`,
      project: task.project,
      title: task.title,
      hours: task.hours,
      urgency: task.urgency,
      status: "todo",
      projectId: null,
      order: previous.length,
    });
    const ok = await applyCollectionMutation({
      key: "tasks",
      previous,
      next: [...previous, newTask],
      commit: () => api.tasks.upsert(newTask).then(() => undefined),
      rollbackMessage: "Failed to save task.",
    });
    return ok ? newTask.id : undefined;
  },
  updateTask: async (id, updates) => {
    const previous = get().tasks;
    const item = previous.find((task) => task.id === id);
    if (!item) return false;
    const updated = { ...item, ...updates, updatedAt: new Date().toISOString() };
    return applyCollectionMutation({
      key: "tasks",
      previous,
      next: previous.map((task) => (task.id === id ? updated : task)),
      commit: () => api.tasks.upsert(updated).then(() => undefined),
      rollbackMessage: "Failed to update task.",
    });
  },
  deleteTask: async (id) =>
    applyCollectionMutation({
      key: "tasks",
      previous: get().tasks,
      next: get().tasks.filter((task) => task.id !== id),
      commit: () => api.tasks.delete(id).then(() => undefined),
      rollbackMessage: "Failed to delete task.",
    }),

  addTodoItem: async (todoItem) => {
    const previous = get().todoItems;
    const newTodoItem = withTimestamp<TodoItem>({
      id: `todo_${Math.random().toString(36).slice(2, 10)}`,
      project: todoItem.project,
      title: todoItem.title,
      hours: todoItem.hours,
      urgency: todoItem.urgency,
      completed: false,
    });
    const ok = await applyCollectionMutation({
      key: "todoItems",
      previous,
      next: [...previous, newTodoItem],
      commit: () => api.todoItems.upsert(newTodoItem).then(() => undefined),
      rollbackMessage: "Failed to save to-do item.",
    });
    return ok ? newTodoItem.id : undefined;
  },
  updateTodoItem: async (id, updates) => {
    const previous = get().todoItems;
    const item = previous.find((todoItem) => todoItem.id === id);
    if (!item) return false;
    const updated = { ...item, ...updates, updatedAt: new Date().toISOString() };
    return applyCollectionMutation({
      key: "todoItems",
      previous,
      next: previous.map((todoItem) => (todoItem.id === id ? updated : todoItem)),
      commit: () => api.todoItems.upsert(updated).then(() => undefined),
      rollbackMessage: "Failed to update to-do item.",
    });
  },
  deleteTodoItem: async (id) =>
    applyCollectionMutation({
      key: "todoItems",
      previous: get().todoItems,
      next: get().todoItems.filter((todoItem) => todoItem.id !== id),
      commit: () => api.todoItems.delete(id).then(() => undefined),
      rollbackMessage: "Failed to delete to-do item.",
    }),

  addPlanItem: async (date, title, priority, linkedTaskId = null) => {
    const previous = get().plansByDate[date] ?? [];
    const newItem: PlanItem = {
      id: `plan_${Math.random().toString(36).slice(2, 10)}`,
      title,
      linkedTaskId,
      priority,
      status: "planned",
      order: previous.length,
    };
    return applyPlanMutation({
      date,
      previous,
      next: [...previous, newItem],
      commit: () => api.plans.upsert(date, newItem).then(() => undefined),
      rollbackMessage: "Failed to save plan item.",
    });
  },
  updatePlanItem: async (date, id, updates) => {
    const previous = get().plansByDate[date] ?? [];
    const item = previous.find((plan) => plan.id === id);
    if (!item) return false;
    const updated = { ...item, ...updates };
    return applyPlanMutation({
      date,
      previous,
      next: previous.map((plan) => (plan.id === id ? updated : plan)),
      commit: () => api.plans.upsert(date, updated).then(() => undefined),
      rollbackMessage: "Failed to update plan item.",
    });
  },
  deletePlanItem: async (date, id) =>
    applyPlanMutation({
      date,
      previous: get().plansByDate[date] ?? [],
      next: (get().plansByDate[date] ?? []).filter((plan) => plan.id !== id),
      commit: () => api.plans.delete(id).then(() => undefined),
      rollbackMessage: "Failed to delete plan item.",
    }),

  updateSettings: async (updates) => {
    const previous = get().settings;
    const updated = { ...previous, ...updates };
    set((state) => ({
      settings: updated,
      error: { ...state.error, settings: null },
    }));
    try {
      await api.settings.update(updated);
      if (updates.theme) {
        const theme = updates.theme;
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && prefersDark));
      }
      return true;
    } catch (error) {
      set((state) => ({
        settings: previous,
        error: { ...state.error, settings: getErrorMessage(error, "Failed to update settings.") },
      }));
      return false;
    }
  },

  addSession: async (session) => {
    const previous = get().sessions;
    const next = [session, ...previous.filter((entry) => entry.id !== session.id)];
    const ok = await applyCollectionMutation({
      key: "sessions",
      previous,
      next,
      commit: () => api.sessions.upsert(session).then(() => undefined),
      rollbackMessage: "Failed to save session.",
    });
    return ok ? session.id : undefined;
  },
  deleteSession: async (id) =>
    applyCollectionMutation({
      key: "sessions",
      previous: get().sessions,
      next: get().sessions.filter((session) => session.id !== id),
      commit: () => api.sessions.delete(id).then(() => undefined),
      rollbackMessage: "Failed to delete session.",
    }),
}));
