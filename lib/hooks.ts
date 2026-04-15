import { useState, useEffect, useCallback } from "react";
import { api } from "./api";
import {
  Project,
  Task,
  TodoItem,
  FocusSession,
  PlanItem,
  TimerSettings,
  defaultSettings,
  defaultProject,
} from "./domain";
import { getDateKey, uid } from "./utils";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await api.projects.list();
      setProjects(data.length > 0 ? data : [defaultProject]);
    } catch (error) {
      console.error("Failed to fetch projects", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const addProject = async (title: string) => {
    setError(null);
    const newProject: Project = {
      id: uid("project"),
      title,
      order: projects.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const previousProjects = projects;
    setProjects((prev) => [...prev, newProject]);
    try {
      await api.projects.upsert(newProject);
      return newProject.id;
    } catch (error) {
      setProjects(previousProjects);
      setError(error instanceof Error ? error.message : "Failed to save project.");
      return undefined;
    }
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    setError(null);
    const updated = { ...project, ...updates, updatedAt: new Date().toISOString() };
    const previousProjects = projects;
    setProjects((prev) => prev.map((item) => (item.id === id ? updated : item)));
    try {
      await api.projects.upsert(updated);
      return true;
    } catch (error) {
      setProjects(previousProjects);
      setError(error instanceof Error ? error.message : "Failed to update project.");
      return false;
    }
  };

  const deleteProject = async (id: string) => {
    setError(null);
    const previousProjects = projects;
    setProjects((prev) => prev.filter((item) => item.id !== id));
    try {
      await api.projects.delete(id);
      return true;
    } catch (error) {
      setProjects(previousProjects);
      setError(error instanceof Error ? error.message : "Failed to delete project.");
      return false;
    }
  };

  return { projects, loading, error, addProject, updateProject, deleteProject, refresh: fetchProjects };
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await api.tasks.list();
      setTasks(data);
    } catch (error) {
      console.error("Failed to fetch tasks", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = async (task: Pick<Task, "project" | "title" | "hours" | "urgency">) => {
    setError(null);
    const newTask: Task = {
      id: uid("task"),
      project: task.project,
      title: task.title,
      hours: task.hours,
      urgency: task.urgency,
      status: "todo",
      projectId: null,
      order: tasks.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const previousTasks = tasks;
    setTasks((prev) => [...prev, newTask]);
    try {
      await api.tasks.upsert(newTask);
      return newTask.id;
    } catch (error) {
      setTasks(previousTasks);
      setError(error instanceof Error ? error.message : "Failed to save task.");
      return undefined;
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    setError(null);
    const updated = { ...task, ...updates, updatedAt: new Date().toISOString() };
    const previousTasks = tasks;
    setTasks((prev) => prev.map((item) => (item.id === id ? updated : item)));
    try {
      await api.tasks.upsert(updated);
      return true;
    } catch (error) {
      setTasks(previousTasks);
      setError(error instanceof Error ? error.message : "Failed to update task.");
      return false;
    }
  };

  const deleteTask = async (id: string) => {
    setError(null);
    const previousTasks = tasks;
    setTasks((prev) => prev.filter((item) => item.id !== id));
    try {
      await api.tasks.delete(id);
      return true;
    } catch (error) {
      setTasks(previousTasks);
      setError(error instanceof Error ? error.message : "Failed to delete task.");
      return false;
    }
  };

  return { tasks, loading, error, addTask, updateTask, deleteTask, refresh: fetchTasks };
}

export function useTodoItems() {
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTodoItems = useCallback(async () => {
    try {
      const data = await api.todoItems.list();
      setTodoItems(data);
    } catch (error) {
      console.error("Failed to fetch to-do items", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodoItems();
  }, [fetchTodoItems]);

  const addTodoItem = async (todoItem: Pick<TodoItem, "project" | "title" | "hours" | "urgency">) => {
    setError(null);
    const newTodoItem: TodoItem = {
      id: uid("todo"),
      project: todoItem.project,
      title: todoItem.title,
      hours: todoItem.hours,
      urgency: todoItem.urgency,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const previousTodoItems = todoItems;
    setTodoItems((prev) => [...prev, newTodoItem]);
    try {
      await api.todoItems.upsert(newTodoItem);
      return newTodoItem.id;
    } catch (error) {
      setTodoItems(previousTodoItems);
      setError(error instanceof Error ? error.message : "Failed to save to-do item.");
      return undefined;
    }
  };

  const updateTodoItem = async (id: string, updates: Partial<TodoItem>) => {
    const todoItem = todoItems.find((item) => item.id === id);
    if (!todoItem) return;
    setError(null);
    const updated = { ...todoItem, ...updates, updatedAt: new Date().toISOString() };
    const previousTodoItems = todoItems;
    setTodoItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
    try {
      await api.todoItems.upsert(updated);
      return true;
    } catch (error) {
      setTodoItems(previousTodoItems);
      setError(error instanceof Error ? error.message : "Failed to update to-do item.");
      return false;
    }
  };

  const deleteTodoItem = async (id: string) => {
    setError(null);
    const previousTodoItems = todoItems;
    setTodoItems((prev) => prev.filter((item) => item.id !== id));
    try {
      await api.todoItems.delete(id);
      return true;
    } catch (error) {
      setTodoItems(previousTodoItems);
      setError(error instanceof Error ? error.message : "Failed to delete to-do item.");
      return false;
    }
  };

  return { todoItems, loading, error, addTodoItem, updateTodoItem, deleteTodoItem, refresh: fetchTodoItems };
}

export function usePlans(date: string = getDateKey()) {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      const data = await api.plans.list(date);
      setPlans(data);
    } catch (error) {
      console.error("Failed to fetch plans", error);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const addPlanItem = async (title: string, priority: PlanItem["priority"], linkedTaskId: string | null = null) => {
    setError(null);
    const newItem: PlanItem = {
      id: uid("plan"),
      title,
      linkedTaskId,
      priority,
      status: "planned",
      order: plans.length,
    };
    const previousPlans = plans;
    setPlans((prev) => [...prev, newItem]);
    try {
      await api.plans.upsert(date, newItem);
      return true;
    } catch (error) {
      setPlans(previousPlans);
      setError(error instanceof Error ? error.message : "Failed to save plan item.");
      return false;
    }
  };

  const updatePlanItem = async (id: string, updates: Partial<PlanItem>) => {
    const item = plans.find((item) => item.id === id);
    if (!item) return;
    setError(null);
    const updated = { ...item, ...updates };
    const previousPlans = plans;
    setPlans((prev) => prev.map((entry) => (entry.id === id ? updated : entry)));
    try {
      await api.plans.upsert(date, updated);
      return true;
    } catch (error) {
      setPlans(previousPlans);
      setError(error instanceof Error ? error.message : "Failed to update plan item.");
      return false;
    }
  };

  const deletePlanItem = async (id: string) => {
    setError(null);
    const previousPlans = plans;
    setPlans((prev) => prev.filter((item) => item.id !== id));
    try {
      await api.plans.delete(id);
      return true;
    } catch (error) {
      setPlans(previousPlans);
      setError(error instanceof Error ? error.message : "Failed to delete plan item.");
      return false;
    }
  };

  return { plans, loading, error, addPlanItem, updatePlanItem, deletePlanItem, refresh: fetchPlans };
}

export function useSettings() {
  const [settings, setSettings] = useState<TimerSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.settings.get();
      setSettings(data);
    } catch (error) {
      console.error("Failed to fetch settings", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<TimerSettings>) => {
    const updated = { ...settings, ...updates };
    const previousSettings = settings;
    setError(null);
    setSettings(updated);
    try {
      await api.settings.update(updated);

      if (updates.theme) {
        const theme = updates.theme;
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && prefersDark));
      }
      return true;
    } catch (error) {
      setSettings(previousSettings);
      setError(error instanceof Error ? error.message : "Failed to update settings.");
      return false;
    }
  };

  return { settings, loading, error, updateSettings, refresh: fetchSettings };
}

export function useSessions(range?: { start: string; end: string }) {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await api.sessions.list(range);
      setSessions(data);
    } catch (error) {
      console.error("Failed to fetch sessions", error);
    } finally {
      setLoading(false);
    }
  }, [range?.start, range?.end]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const addSession = async (session: FocusSession) => {
    setError(null);
    const previousSessions = sessions;
    setSessions((prev) => [session, ...prev]);
    try {
      await api.sessions.upsert(session);
      return session.id;
    } catch (error) {
      setSessions(previousSessions);
      setError(error instanceof Error ? error.message : "Failed to save session.");
      return undefined;
    }
  };

  const deleteSession = async (id: string) => {
    setError(null);
    const previousSessions = sessions;
    setSessions((prev) => prev.filter((item) => item.id !== id));
    try {
      await api.sessions.delete(id);
      return true;
    } catch (error) {
      setSessions(previousSessions);
      setError(error instanceof Error ? error.message : "Failed to delete session.");
      return false;
    }
  };

  return { sessions, loading, error, addSession, deleteSession, refresh: fetchSessions };
}
