"use client";

import {
  AppData,
  defaultAppData,
  defaultProject,
  DistractionItem,
  FocusSession,
  PlanItem,
  SessionNote,
  TimerSettings,
  appDataSchema,
  Task,
} from "@/lib/domain";
import { getDateKey } from "@/lib/utils";
import { supabase, SupabaseSession } from "./supabase";

const STORAGE_KEY = "sister-focus-app-data";
let storageNamespace = "guest";

export function setStorageNamespace(namespace: string) {
  storageNamespace = namespace || "guest";
}

function storageKey() {
  return `${STORAGE_KEY}:${storageNamespace}`;
}

function readStorage(): AppData {
  if (typeof window === "undefined") {
    return defaultAppData;
  }

  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) {
      return defaultAppData;
    }

    return appDataSchema.parse(JSON.parse(raw));
  } catch {
    return defaultAppData;
  }
}

function writeStorage(data: AppData) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey(), JSON.stringify(data));
}

function normalizeOrder<T extends { order: number }>(items: T[]) {
  return items.map((item, index) => ({ ...item, order: index }));
}

function normalizeAppData(data: AppData): AppData {
  const projects = normalizeOrder(data.projects.length > 0 ? data.projects : [defaultProject]);
  const projectIds = new Set(projects.map((project) => project.id));
  const fallbackProjectId = projects[0]?.id ?? defaultProject.id;
  const normalizedTasks = normalizeOrder(
    data.tasks.map((task) => ({
      ...task,
      projectId: task.projectId && projectIds.has(task.projectId) ? task.projectId : fallbackProjectId,
    })),
  );
  const taskProjectMap = new Map(normalizedTasks.map((task) => [task.id, task.projectId ?? fallbackProjectId]));
  const activeTask = normalizedTasks.find((task) => task.id === data.activeTaskId) ?? null;
  const activeProjectId = data.activeProjectId && projectIds.has(data.activeProjectId)
    ? data.activeProjectId
    : activeTask?.projectId ?? fallbackProjectId;
  const activeTaskId = activeTask && activeTask.projectId === activeProjectId ? activeTask.id : null;

  return {
    ...data,
    projects,
    tasks: normalizedTasks,
    sessions: data.sessions.map((session) => ({
      ...session,
      projectId: session.projectId ?? (session.taskId ? taskProjectMap.get(session.taskId) ?? null : null),
    })),
    activeProjectId,
    activeTaskId,
  };
}

export interface AppRepository {
  load(): AppData;
  save(data: AppData): void;
  getSettings(): TimerSettings;
  saveSettings(settings: TimerSettings): void;
  getTasks(): Task[];
  saveTasks(tasks: Task[]): void;
  getPlanForDate(date: string): PlanItem[];
  savePlanForDate(date: string, items: PlanItem[]): void;
  getSessions(range?: { start?: string; end?: string }): FocusSession[];
  appendSession(session: FocusSession): void;
  saveSession(session: FocusSession): void;
  deleteSession(sessionId: string): Promise<void>;
  getNotes(sessionId: string): SessionNote[];
  appendNote(note: SessionNote): void;
  getDistractions(date: string): DistractionItem[];
  saveDistractions(date: string, items: DistractionItem[]): void;
  syncWithCloud(userId: string): Promise<AppData | null>;
}

export class LocalAppRepository implements AppRepository {
  private currentCloudUserId: string | null = null;

  load() {
    return normalizeAppData(readStorage());
  }

  save(data: AppData) {
    writeStorage(normalizeAppData(data));
  }

  getSettings() {
    return readStorage().settings;
  }

  saveSettings(settings: TimerSettings) {
    const data = readStorage();
    data.settings = settings;
    writeStorage(normalizeAppData(data));
  }

  saveTasks(tasks: Task[]) {
    const data = readStorage();
    data.tasks = tasks;
    writeStorage(normalizeAppData(data));
  }

  async saveTask(task: Task) {
    const data = readStorage();
    data.tasks = data.tasks.map((t) => (t.id === task.id ? task : t));
    if (!data.tasks.some((t) => t.id === task.id)) {
      data.tasks.push(task);
    }
    writeStorage(normalizeAppData(data));

    if (this.currentCloudUserId) {
      console.log(`[Repository] Syncing task ${task.id} to cloud...`);
      const { error } = await supabase.from("tasks").upsert({
        id: task.id,
        user_id: this.currentCloudUserId,
        project_id: task.projectId,
        title: task.title,
        estimate_pomodoros: task.estimate_pomodoros,
        completed_pomodoros: task.completedPomodoros,
        status: task.status,
        order: task.order,
        updated_at: task.updatedAt,
        raw_data: task,
      });
      if (error) console.error("[Repository] Task sync failed:", error);
    }
  }

  async deleteTask(taskId: string) {
    const data = readStorage();
    data.tasks = data.tasks.filter((t) => t.id !== taskId);
    writeStorage(normalizeAppData(data));

    if (this.currentCloudUserId) {
      console.log(`[Repository] Deleting task ${taskId} from cloud...`);
      const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", this.currentCloudUserId);
      if (error) console.error("[Repository] Task delete failed:", error);
    }
  }

  getPlanForDate(date: string) {
    return readStorage().plansByDate[date] ?? [];
  }

  savePlanForDate(date: string, items: PlanItem[]) {
    const data = readStorage();
    data.plansByDate[date] = items;
    writeStorage(normalizeAppData(data));
  }

  getSessions(range?: { start?: string; end?: string }) {
    const sessions = readStorage().sessions;
    if (!range) {
      return sessions;
    }

    return sessions.filter((session) => {
      if (range.start && session.startedAt < range.start) {
        return false;
      }
      if (range.end && session.startedAt > range.end) {
        return false;
      }
      return true;
    });
  }

  private async pushSessionToCloud(session: FocusSession) {
    if (!this.currentCloudUserId) return;

    const startDate = new Date(session.startedAt);
    const endDate = new Date(session.endedAt);
    
    // We need projects and tasks to get titles for the search-optimized columns
    const data = readStorage();
    const projectMap = new Map(data.projects.map((p) => [p.id, p.title]));
    const taskMap = new Map(data.tasks.map((t) => [t.id, t.title]));

    const supabaseSession: SupabaseSession = {
      id: session.id,
      user_id: this.currentCloudUserId,
      date: session.startedAt.slice(0, 10),
      project_title: (session.projectId ? projectMap.get(session.projectId) : null) ?? session.projectName ?? "Unassigned",
      task_title: (session.taskId ? taskMap.get(session.taskId) : null) ?? session.taskName ?? "Unassigned",
      hours: Number((session.actualDurationSec / 3600).toFixed(2)),
      start_time: startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
      end_time: endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
      raw_data: session,
    };

    console.log(`[Repository] Pushing session ${session.id} to cloud...`);
    const { error } = await supabase.from("sessions").upsert(supabaseSession);
    if (error) {
      console.error("[Repository] Cloud push failed:", error);
    } else {
      console.log(`[Repository] Session ${session.id} synced to cloud.`);
    }
  }

  appendSession(session: FocusSession) {
    const data = readStorage();
    data.sessions = [...data.sessions, session];
    writeStorage(normalizeAppData(data));
    
    if (this.currentCloudUserId) {
      void this.pushSessionToCloud(session);
    }
  }

  saveSession(session: FocusSession) {
    const data = readStorage();
    data.sessions = data.sessions.map((s) => (s.id === session.id ? session : s));
    writeStorage(normalizeAppData(data));

    if (this.currentCloudUserId) {
      void this.pushSessionToCloud(session);
    }
  }

  async deleteSession(sessionId: string) {
    const data = readStorage();
    data.sessions = data.sessions.filter((session) => session.id !== sessionId);
    writeStorage(normalizeAppData(data));

    if (!this.currentCloudUserId) {
      return;
    }

    console.log(`[Repository] Deleting session ${sessionId} from cloud...`);
    const { error } = await supabase.from("sessions").delete().eq("id", sessionId).eq("user_id", this.currentCloudUserId);
    if (error) {
      console.error("[Repository] Cloud session delete failed:", error);
    } else {
      console.log(`[Repository] Session ${sessionId} deleted from cloud.`);
    }
  }

  getNotes(sessionId: string) {
    return readStorage().notesBySession[sessionId] ?? [];
  }

  appendNote(note: SessionNote) {
    const data = readStorage();
    data.notesBySession[note.sessionId] = [...(data.notesBySession[note.sessionId] ?? []), note];
    writeStorage(normalizeAppData(data));
  }

  getDistractions(date: string) {
    return readStorage().distractionsByDate[date] ?? [];
  }

  saveDistractions(date: string, items: DistractionItem[]) {
    const data = readStorage();
    data.distractionsByDate[date] = items;
    writeStorage(normalizeAppData(data));
  }

  async syncWithCloud(userId: string): Promise<AppData | null> {
    if (typeof window === "undefined" || userId === "guest") {
      return null;
    }

    this.currentCloudUserId = userId;

    try {
      const data = readStorage();
      const localSessions = data.sessions;

      // 1. Prepare local sessions for Supabase (aligning with report.csv structure)
      const projectMap = new Map(data.projects.map((p) => [p.id, p.title]));
      const taskMap = new Map(data.tasks.map((t) => [t.id, t.title]));

      const supabaseSessions: SupabaseSession[] = localSessions.map((s) => {
        const startDate = new Date(s.startedAt);
        const endDate = new Date(s.endedAt);
        return {
          id: s.id,
          user_id: userId,
          date: s.startedAt.slice(0, 10),
          project_title: (s.projectId ? projectMap.get(s.projectId) : null) ?? s.projectName ?? "Unassigned",
          task_title: (s.taskId ? taskMap.get(s.taskId) : null) ?? s.taskName ?? "Unassigned",
          hours: Number((s.actualDurationSec / 3600).toFixed(2)),
          start_time: startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
          end_time: endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
          raw_data: s,
        };
      });

      // 2. Push local sessions to Supabase (UPSERT)
      if (supabaseSessions.length > 0) {
        const { error: pushError } = await supabase
          .from("sessions")
          .upsert(supabaseSessions, { onConflict: "id" });
        if (pushError) throw pushError;
      }

      // 3. Pull latest sessions from Supabase
      const { data: cloudSessions, error: pullError } = await supabase
        .from("sessions")
        .select("raw_data")
        .eq("user_id", userId);

      if (pullError) throw pullError;

      if (cloudSessions) {
        const mergedSessions = cloudSessions.map((row: any) => row.raw_data as FocusSession);
        
        // Merge strategy: Unique by ID, keeping the latest version if there's overlap
        const sessionMap = new Map<string, FocusSession>();
        localSessions.forEach((s) => sessionMap.set(s.id, s));
        mergedSessions.forEach((s) => sessionMap.set(s.id, s));

        const finalSessions = Array.from(sessionMap.values());
        const updatedData = { ...data, sessions: finalSessions };
        writeStorage(normalizeAppData(updatedData));
        return updatedData;
      }
    } catch (err) {
      console.error("Cloud sync failed:", err);
    }
    return null;
  }
}

export const appRepository = new LocalAppRepository();

export function getTodayData() {
  const data = normalizeAppData(readStorage());
  const dateKey = getDateKey();
  return {
    projects: data.projects,
    tasks: data.tasks,
    plan: data.plansByDate[dateKey] ?? [],
    distractions: data.distractionsByDate[dateKey] ?? [],
    activeProjectId: data.activeProjectId,
    activeTaskId: data.activeTaskId,
  };
}
