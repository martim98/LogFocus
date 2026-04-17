import { getFocusSessions, getSessionsInRange } from "@/lib/analytics";
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

  const content = [HEADER, ...rows]
    .map((row) => row.map((value) => escapeCsvCell(value, delimiter)).join(delimiter))
    .join("\n");

  return `\uFEFF${content}`;
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
