"use client";

import { useEffect } from "react";
import type { PlanItem } from "./domain";
import { getDateKey } from "./utils";
import { useWorkspaceStore } from "./workspace-store";

export function useProjects() {
  const projects = useWorkspaceStore((state) => state.projects);
  const loading = useWorkspaceStore((state) => state.loading.projects);
  const error = useWorkspaceStore((state) => state.error.projects);
  const ensureProjects = useWorkspaceStore((state) => state.ensureProjects);
  const addProject = useWorkspaceStore((state) => state.addProject);
  const updateProject = useWorkspaceStore((state) => state.updateProject);
  const deleteProject = useWorkspaceStore((state) => state.deleteProject);
  const refresh = useWorkspaceStore((state) => state.refreshProjects);

  useEffect(() => {
    void ensureProjects();
  }, [ensureProjects]);

  return { projects, loading, error, addProject, updateProject, deleteProject, refresh };
}

export function useTasks() {
  const tasks = useWorkspaceStore((state) => state.tasks);
  const loading = useWorkspaceStore((state) => state.loading.tasks);
  const error = useWorkspaceStore((state) => state.error.tasks);
  const ensureTasks = useWorkspaceStore((state) => state.ensureTasks);
  const addTask = useWorkspaceStore((state) => state.addTask);
  const updateTask = useWorkspaceStore((state) => state.updateTask);
  const deleteTask = useWorkspaceStore((state) => state.deleteTask);
  const refresh = useWorkspaceStore((state) => state.refreshTasks);

  useEffect(() => {
    void ensureTasks();
  }, [ensureTasks]);

  return { tasks, loading, error, addTask, updateTask, deleteTask, refresh };
}

export function useTodoItems() {
  const todoItems = useWorkspaceStore((state) => state.todoItems);
  const loading = useWorkspaceStore((state) => state.loading.todoItems);
  const error = useWorkspaceStore((state) => state.error.todoItems);
  const ensureTodoItems = useWorkspaceStore((state) => state.ensureTodoItems);
  const addTodoItem = useWorkspaceStore((state) => state.addTodoItem);
  const updateTodoItem = useWorkspaceStore((state) => state.updateTodoItem);
  const deleteTodoItem = useWorkspaceStore((state) => state.deleteTodoItem);
  const refresh = useWorkspaceStore((state) => state.refreshTodoItems);

  useEffect(() => {
    void ensureTodoItems();
  }, [ensureTodoItems]);

  return { todoItems, loading, error, addTodoItem, updateTodoItem, deleteTodoItem, refresh };
}

export function usePlans(date: string = getDateKey()) {
  const plans = useWorkspaceStore((state) => state.plansByDate[date] ?? []);
  const loading = useWorkspaceStore((state) => Boolean(state.loading.plans[date]));
  const error = useWorkspaceStore((state) => state.error.plans[date] ?? null);
  const ensurePlans = useWorkspaceStore((state) => state.ensurePlans);
  const addPlanItemStore = useWorkspaceStore((state) => state.addPlanItem);
  const updatePlanItemStore = useWorkspaceStore((state) => state.updatePlanItem);
  const deletePlanItemStore = useWorkspaceStore((state) => state.deletePlanItem);
  const refresh = useWorkspaceStore((state) => state.refreshPlans);

  useEffect(() => {
    void ensurePlans(date);
  }, [date, ensurePlans]);

  const addPlanItem = (title: string, priority: PlanItem["priority"], linkedTaskId: string | null = null) =>
    addPlanItemStore(date, title, priority, linkedTaskId);
  const updatePlanItem = (id: string, updates: Partial<PlanItem>) => updatePlanItemStore(date, id, updates);
  const deletePlanItem = (id: string) => deletePlanItemStore(date, id);

  return { plans, loading, error, addPlanItem, updatePlanItem, deletePlanItem, refresh: () => refresh(date) };
}

export function useSettings() {
  const settings = useWorkspaceStore((state) => state.settings);
  const loading = useWorkspaceStore((state) => state.loading.settings);
  const error = useWorkspaceStore((state) => state.error.settings);
  const ensureSettings = useWorkspaceStore((state) => state.ensureSettings);
  const updateSettings = useWorkspaceStore((state) => state.updateSettings);
  const refresh = useWorkspaceStore((state) => state.refreshSettings);

  useEffect(() => {
    void ensureSettings();
  }, [ensureSettings]);

  return { settings, loading, error, updateSettings, refresh };
}

export function useSessions(range?: { start: string; end: string }) {
  const sessions = useWorkspaceStore((state) => state.sessions);
  const loading = useWorkspaceStore((state) => state.loading.sessions);
  const error = useWorkspaceStore((state) => state.error.sessions);
  const ensureSessions = useWorkspaceStore((state) => state.ensureSessions);
  const addSession = useWorkspaceStore((state) => state.addSession);
  const deleteSession = useWorkspaceStore((state) => state.deleteSession);
  const refreshStore = useWorkspaceStore((state) => state.refreshSessions);

  useEffect(() => {
    void ensureSessions(range);
  }, [ensureSessions, range?.end, range?.start]);

  return { sessions, loading, error, addSession, deleteSession, refresh: () => refreshStore(range) };
}
