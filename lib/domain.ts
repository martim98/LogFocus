import { z } from "zod";

export const sessionModeSchema = z.enum(["focus", "shortBreak", "longBreak"]);
export type SessionMode = z.infer<typeof sessionModeSchema>;

export const timerModeSchema = z.literal("focus");
export type TimerMode = z.infer<typeof timerModeSchema>;

export const prioritySchema = z.enum(["must", "should", "bonus"]);
export type PlanPriority = z.infer<typeof prioritySchema>;

export const taskStatusSchema = z.enum(["todo", "done"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const todoUrgencySchema = z.union([z.literal(0), z.literal(0.5), z.literal(1), z.literal(2)]);
export type TodoUrgency = z.infer<typeof todoUrgencySchema>;

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
  dailyWorkHours: z.number().min(1).max(24),
  workweekDays: z.number().int().min(1).max(7),
  billingWorkHoursPerDay: z.number().min(1).max(24),
  billingWeeklyHours: z.number().min(1).max(168),
  billableTargetRate: z.number().min(0).max(1),
  billingWeekEndDay: z.number().int().min(0).max(6),
  billingWeekEndTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/),
  autoStartFocus: z.boolean(),
  soundEnabled: z.boolean(),
  soundType: z.enum(["bell", "chime", "none"]),
  notificationEnabled: z.boolean(),
  theme: themeSchema,
});
export type TimerSettings = z.infer<typeof timerSettingsSchema>;

export const taskSchema = z.object({
  id: z.string(),
  project: z.string().max(140).default(""),
  title: z.string().min(1).max(140),
  hours: z.number().min(0.5).max(24),
  urgency: z.number().min(0).max(30),
  status: taskStatusSchema,
  projectId: z.string().nullable().default(null),
  order: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof taskSchema>;

export const todoItemSchema = z.object({
  id: z.string(),
  project: z.string().min(1).max(140),
  title: z.string().min(1).max(140),
  hours: z.number().min(0.1).max(24),
  urgency: todoUrgencySchema,
  completed: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TodoItem = z.infer<typeof todoItemSchema>;

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
  mode: sessionModeSchema,
  projectId: z.string().nullable().default(null),
  projectName: z.string().nullable().default(null),
  taskId: z.string().nullable(),
  taskName: z.string().nullable().default(null),
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

export const defaultSettings: TimerSettings = {
  focusMinutes: 25,
  dailyWorkHours: 6,
  workweekDays: 5,
  billingWorkHoursPerDay: 8,
  billingWeeklyHours: 40,
  billableTargetRate: 0.85,
  billingWeekEndDay: 5,
  billingWeekEndTime: "18:00",
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
