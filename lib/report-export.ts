import { getFocusSessions, getSessionsInRange, roundUpToQuarterHour } from "@/lib/analytics";
import type { FocusSession, Project, Task } from "@/lib/domain";
import { endOfDayIso, startOfDayIso } from "@/lib/utils";

export type ReportDelimiter = "comma" | "tab";
export type ReportTimeFormat = "hours" | "minutes";

export type ReportExportOptions = {
  startDate: string;
  endDate: string;
  includeTask: boolean;
  delimiter: ReportDelimiter;
  timeFormat: ReportTimeFormat;
};

const HEADER = ["date", "project", "task", "hours", "startTime", "endTime"];

export function buildPomofocusReportCsv(
  sessions: FocusSession[],
  projects: Project[],
  tasks: Task[],
  options: ReportExportOptions,
) {
  const delimiter = options.delimiter === "tab" ? "\t" : ",";
  const projectById = new Map(projects.map((project) => [project.id, project.title]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const startIso = startOfDayIso(options.startDate);
  const endIso = endOfDayIso(options.endDate);

  const rows = getFocusSessions(getSessionsInRange(sessions, startIso, endIso))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((session) => {
      const task = session.taskId ? taskById.get(session.taskId) ?? null : null;
      const projectTitle = resolveProjectTitle(session.projectId, task?.projectId ?? null, session.projectName, projectById);
      const taskTitle = options.includeTask ? (task?.title ?? session.taskName ?? "") : "";
      const hours = options.timeFormat === "minutes"
        ? String(Math.round(session.actualDurationSec / 60))
        : formatHours(session.actualDurationSec / 3600);

      return [
        formatDateKey(session.startedAt),
        projectTitle,
        taskTitle,
        hours,
        formatTime(session.startedAt),
        formatTime(session.endedAt),
      ];
    });

  return buildCsv([HEADER, ...rows], delimiter);
}

export type BillableGroupedExportOptions = {
  startDate: string;
  endDate: string;
  delimiter: ReportDelimiter;
};

export function buildGroupedBillableReportCsv(
  sessions: FocusSession[],
  projects: Project[],
  tasks: Task[],
  options: BillableGroupedExportOptions,
) {
  const delimiter = options.delimiter === "tab" ? "\t" : ",";
  const projectById = new Map(projects.map((project) => [project.id, project.title]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const startIso = startOfDayIso(options.startDate);
  const endIso = endOfDayIso(options.endDate);

  const rows = buildGroupedBillableRows(getFocusSessions(getSessionsInRange(sessions, startIso, endIso)), projectById, taskById);
  return buildCsv([HEADER, ...rows], delimiter);
}

export function countGroupedBillableReportRows(
  sessions: FocusSession[],
  projects: Project[],
  tasks: Task[],
  options: BillableGroupedExportOptions,
) {
  const projectById = new Map(projects.map((project) => [project.id, project.title]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const startIso = startOfDayIso(options.startDate);
  const endIso = endOfDayIso(options.endDate);
  const rows = buildGroupedBillableRows(getFocusSessions(getSessionsInRange(sessions, startIso, endIso)), projectById, taskById);
  return rows.length;
}

export function downloadReportCsv(filename: string, content: string) {
  if (typeof window === "undefined") {
    return;
  }

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function resolveProjectTitle(
  projectId: string | null,
  fallbackProjectId: string | null,
  fallbackProjectName: string | null,
  projectById: Map<string, string>,
) {
  const resolvedId = projectId ?? fallbackProjectId;
  if (resolvedId) {
    return projectById.get(resolvedId) ?? fallbackProjectName ?? "";
  }
  return fallbackProjectName ?? "";
}

function buildGroupedBillableRows(
  sessions: FocusSession[],
  projectById: Map<string, string>,
  taskById: Map<string, Task>,
) {
  const grouped = new Map<
    string,
    {
      dateKey: string;
      project: string;
      task: string;
      rawHours: number;
      startIso: string;
      endIso: string;
    }
  >();

  const orderedSessions = sessions.slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  for (const session of orderedSessions) {
    const task = session.taskId ? taskById.get(session.taskId) ?? null : null;
    const projectTitle = resolveProjectTitle(session.projectId, task?.projectId ?? null, session.projectName, projectById).trim() || "Unassigned";
    const taskTitle = resolveTaskTitle(task?.title ?? session.taskName ?? null);

    const dateKey = formatDateKey(session.startedAt);
    const key = `${dateKey}::${normalizeKey(projectTitle)}::${normalizeKey(taskTitle)}`;
    const durationHours = session.actualDurationSec / 3600;
    const existing = grouped.get(key);

    if (existing) {
      existing.rawHours += durationHours;
      if (session.startedAt < existing.startIso) {
        existing.startIso = session.startedAt;
      }
      if (session.endedAt > existing.endIso) {
        existing.endIso = session.endedAt;
      }
      continue;
    }

    grouped.set(key, {
      dateKey,
      project: projectTitle,
      task: taskTitle,
      rawHours: durationHours,
      startIso: session.startedAt,
      endIso: session.endedAt,
    });
  }

  return Array.from(grouped.values())
    .map((entry) => [
      entry.dateKey,
      entry.project,
      entry.task,
      formatHours(roundUpToQuarterHour(entry.rawHours)),
      formatTime(entry.startIso),
      formatTime(entry.endIso),
    ])
    .sort((left, right) => {
      if (left[0] !== right[0]) return left[0].localeCompare(right[0]);
      if (left[1] !== right[1]) return left[1].localeCompare(right[1]);
      return left[2].localeCompare(right[2]);
    });
}

function buildCsv(rows: string[][], delimiter: string) {
  const content = rows.map((row) => row.map((value) => escapeCsvCell(value, delimiter)).join(delimiter)).join("\n");
  return `\uFEFF${content}`;
}

function resolveTaskTitle(taskTitle: string | null) {
  const trimmed = taskTitle?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "Unassigned";
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function formatDateKey(dateIso: string) {
  return new Date(dateIso).toISOString().slice(0, 10).replaceAll("-", "");
}

function formatTime(dateIso: string) {
  const date = new Date(dateIso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatHours(totalHours: number) {
  return Number(totalHours.toFixed(2)).toString();
}

function escapeCsvCell(value: string, delimiter: string) {
  const needsQuotes = value.includes(delimiter) || value.includes("\n") || value.includes('"');
  const escaped = value.replaceAll('"', '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}
