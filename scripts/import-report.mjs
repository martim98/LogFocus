import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, join, resolve } from "path";
import { createHash } from "crypto";

const inputPath = resolve(process.argv[2] ?? "report (1).csv");
const outputPath = resolve(process.argv[3] ?? join(".data", "local-store.json"));

const DEFAULT_SETTINGS = {
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

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error("CSV is empty.");
  }

  const rows = lines.map(parseCsvLine);
  const header = rows[0];
  const expected = ["date", "project", "task", "hours", "startTime", "endTime"];
  if (header.join(",") !== expected.join(",")) {
    throw new Error(`Unexpected CSV header: ${header.join(",")}`);
  }

  return rows.slice(1).map((cells) => ({
    date: cells[0],
    project: cells[1],
    task: cells[2],
    hours: Number(cells[3]),
    startTime: cells[4],
    endTime: cells[5],
  }));
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function toLocalDate(dateKey, timeKey) {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(4, 6)) - 1;
  const day = Number(dateKey.slice(6, 8));
  const [hours, minutes] = timeKey.split(":").map(Number);
  return new Date(year, month, day, hours, minutes, 0, 0);
}

function parseTimeKey(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
  };
}

function inferSessionDates(row) {
  const durationMs = Math.round(row.hours * 60 * 60 * 1000);
  const startParts = parseTimeKey(row.startTime);
  const endParts = parseTimeKey(row.endTime);

  if (!startParts && !endParts) {
    return null;
  }

  if (startParts && endParts) {
    const start = toLocalDate(row.date, row.startTime.trim());
    const end = toLocalDate(row.date, row.endTime.trim());
    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }
    return { startedAt: start, endedAt: end };
  }

  if (!startParts && endParts) {
    const end = toLocalDate(row.date, row.endTime.trim());
    const start = new Date(end.getTime() - durationMs);
    return { startedAt: start, endedAt: end };
  }

  const start = toLocalDate(row.date, row.startTime.trim());
  const end = new Date(start.getTime() + durationMs);
  return { startedAt: start, endedAt: end };
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "item";
}

function shortHash(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 8);
}

function makeId(prefix, value) {
  return `${prefix}_${slugify(value)}_${shortHash(value)}`;
}

const rows = parseCsv(await readFile(inputPath, "utf8"));

const projectByName = new Map();
const taskByKey = new Map();
const sessions = [];

for (const row of rows) {
  const projectName = row.project.trim();
  const taskName = row.task.trim();
  const projectKey = projectName || "General";
  const taskKey = `${projectKey}::${taskName}`;
  const timestamps = inferSessionDates(row);

  if (!timestamps) {
    continue;
  }

  const startedAt = timestamps.startedAt.toISOString();
  const endedAt = timestamps.endedAt.toISOString();

  if (!projectByName.has(projectKey)) {
    projectByName.set(projectKey, {
      id: makeId("project", projectKey),
      title: projectKey,
      order: projectByName.size,
      createdAt: startedAt,
      updatedAt: startedAt,
    });
  }

  if (!taskByKey.has(taskKey)) {
    taskByKey.set(taskKey, {
      id: makeId("task", taskKey),
      project: projectKey,
      title: taskName,
      hours: 0,
      urgency: 0,
      status: "todo",
      projectId: projectByName.get(projectKey).id,
      order: taskByKey.size,
      createdAt: startedAt,
      updatedAt: startedAt,
    });
  }

  const task = taskByKey.get(taskKey);
  task.hours = Number((task.hours + row.hours).toFixed(2));
  task.updatedAt = endedAt;

  sessions.push({
    id: makeId("session", `${row.date}-${row.startTime}-${row.project}-${row.task}`),
    mode: "focus",
    projectId: projectByName.get(projectKey).id,
    projectName: projectKey,
    taskId: task.id,
    taskName,
    startedAt,
    endedAt,
    plannedDurationSec: Math.round(row.hours * 3600),
    actualDurationSec: Math.round(row.hours * 3600),
    completed: true,
    interrupted: false,
  });
}

const sortedProjects = [...projectByName.values()];
const sortedTasks = [...taskByKey.values()];

const store = {
  auth: {
    owner: null,
    sessions: [],
  },
  data: {
    projects: sortedProjects,
    tasks: sortedTasks,
    plans: [],
    sessions,
    distractions: [],
    notes: [],
    settings: DEFAULT_SETTINGS,
  },
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");

console.log(`Imported ${rows.length} rows from ${inputPath}`);
console.log(`Wrote local store to ${outputPath}`);
