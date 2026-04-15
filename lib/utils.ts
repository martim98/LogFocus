export function sortTasksByUrgencyAndDuration(tasks: any[], plans: any[]) {
  const urgencyWeight = { must: 0, should: 1, bonus: 2 };
  const planMap = new Map(plans.map((p) => [p.linkedTaskId, p.priority]));

  return [...tasks].sort((a, b) => {
    // 1. Sort by Status (Todo before Done)
    if (a.status !== b.status) return a.status === "todo" ? -1 : 1;

    // 2. Sort by Urgency (must > should > bonus > undefined)
    const urgencyA = planMap.get(a.id) ?? "should";
    const urgencyB = planMap.get(b.id) ?? "should";
    const weightA = urgencyWeight[urgencyA as keyof typeof urgencyWeight] ?? 1;
    const weightB = urgencyWeight[urgencyB as keyof typeof urgencyWeight] ?? 1;

    if (weightA !== weightB) return weightA - weightB;

    // 3. Sort by Duration (Shorter first)
    if (a.hours !== b.hours) {
      return a.hours - b.hours;
    }

    // 4. Final fallback to creation date
    return b.createdAt.localeCompare(a.createdAt);
  });
}

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

export function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
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
  return new Date(`${dateKey}T00:00:00`).toISOString();
}

export function endOfDayIso(dateKey: string) {
  return new Date(`${dateKey}T23:59:59.999`).toISOString();
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
