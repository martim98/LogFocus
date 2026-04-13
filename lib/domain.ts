import { z } from "zod";

export const timerModeSchema = z.enum(["focus", "shortBreak", "longBreak"]);
export type TimerMode = z.infer<typeof timerModeSchema>;

export const prioritySchema = z.enum(["must", "should", "bonus"]);
export type PlanPriority = z.infer<typeof prioritySchema>;

export const taskStatusSchema = z.enum(["todo", "done"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const themeSchema = z.enum(["light", "dark", "system"]);
export type ThemePreference = z.infer<typeof themeSchema>;

export const projectSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(140),
  order: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof projectSchema>;

export const timerSettingsSchema = z.object({
  focusMinutes: z.number().min(1).max(120),
  shortBreakMinutes: z.number().min(1).max(60),
  longBreakMinutes: z.number().min(1).max(90),
  longBreakEvery: z.number().min(2).max(8),
  autoStartBreaks: z.boolean(),
  autoStartFocus: z.boolean(),
  soundEnabled: z.boolean(),
  soundType: z.enum(["bell", "chime", "none"]),
  notificationEnabled: z.boolean(),
  theme: themeSchema,
});
export type TimerSettings = z.infer<typeof timerSettingsSchema>;

export const taskSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(140),
  estimatePomodoros: z.number().min(1).max(20),
  completedPomodoros: z.number().min(0).max(999),
  status: taskStatusSchema,
  projectId: z.string().nullable().default(null),
  order: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof taskSchema>;

export const planItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(140),
  linkedTaskId: z.string().nullable(),
  priority: prioritySchema,
  status: z.enum(["planned", "done"]),
  order: z.number().int().min(0),
});
export type PlanItem = z.infer<typeof planItemSchema>;

export const focusSessionSchema = z.object({
  id: z.string(),
  mode: timerModeSchema,
  projectId: z.string().nullable().default(null),
  taskId: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string(),
  plannedDurationSec: z.number().min(0),
  actualDurationSec: z.number().min(0),
  completed: z.boolean(),
  interrupted: z.boolean(),
});
export type FocusSession = z.infer<typeof focusSessionSchema>;

export const sessionNoteSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  content: z.string().min(1).max(1000),
  createdAt: z.string(),
});
export type SessionNote = z.infer<typeof sessionNoteSchema>;

export const distractionItemSchema = z.object({
  id: z.string(),
  content: z.string().min(1).max(300),
  capturedAt: z.string(),
  resolved: z.boolean(),
  linkedTaskId: z.string().nullable(),
});
export type DistractionItem = z.infer<typeof distractionItemSchema>;

export const appDataSchema = z.object({
  projects: z.array(projectSchema).default([]),
  settings: timerSettingsSchema,
  tasks: z.array(taskSchema),
  plansByDate: z.record(z.string(), z.array(planItemSchema)),
  sessions: z.array(focusSessionSchema),
  notesBySession: z.record(z.string(), z.array(sessionNoteSchema)),
  distractionsByDate: z.record(z.string(), z.array(distractionItemSchema)),
  activeProjectId: z.string().nullable().default(null),
  activeTaskId: z.string().nullable(),
  focusStreakDays: z.number().int().min(0),
});

export type AppData = z.infer<typeof appDataSchema>;

export const defaultSettings: TimerSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  soundEnabled: true,
  soundType: "bell",
  notificationEnabled: false,
  theme: "system",
};

export const defaultProject: Project = {
  id: "project_general",
  title: "General",
  order: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const defaultAppData: AppData = {
  projects: [defaultProject],
  settings: defaultSettings,
  tasks: [],
  plansByDate: {},
  sessions: [],
  notesBySession: {},
  distractionsByDate: {},
  activeProjectId: defaultProject.id,
  activeTaskId: null,
  focusStreakDays: 0,
};
