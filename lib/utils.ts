export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export const DAY_BOUNDARY_HOUR = 3;

export function getDateKey(date = new Date()) {
  const adjusted = new Date(date);
  adjusted.setHours(adjusted.getHours() - DAY_BOUNDARY_HOUR);

  const year = adjusted.getFullYear();
  const month = String(adjusted.getMonth() + 1).padStart(2, "0");
  const day = String(adjusted.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatLocalDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function parseLocalDateTime(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function startOfDayIso(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00`);
  start.setHours(DAY_BOUNDARY_HOUR, 0, 0, 0);
  return start.toISOString();
}

export function endOfDayIso(dateKey: string) {
  const end = new Date(`${dateKey}T00:00:00`);
  end.setHours(DAY_BOUNDARY_HOUR, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return end.toISOString();
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
