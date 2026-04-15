import {
  FocusSession,
  PlanItem,
  Project,
  TodoItem,
  Task,
  TimerSettings,
  defaultSettings,
} from "./domain";

type RequestInitWithBody = Omit<RequestInit, "body"> & {
  body?: unknown;
};

async function requestJson<T>(path: string, init: RequestInitWithBody = {}): Promise<T> {
  const headers = new Headers(init.headers);
  let body: BodyInit | undefined;

  if (init.body !== undefined) {
    if (typeof init.body === "string" || init.body instanceof FormData || init.body instanceof Blob) {
      body = init.body;
    } else {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(init.body);
    }
  }

  const response = await fetch(path, {
    ...init,
    body,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function requestList<T>(resource: string, query?: Record<string, string | undefined>) {
  const url = new URL(`/api/data/${resource}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return requestJson<T>(url.pathname + url.search);
}

async function requestDelete(resource: string, id: string) {
  const url = new URL(`/api/data/${resource}`, window.location.origin);
  url.searchParams.set("id", id);
  return requestJson<{ ok: true }>(url.pathname + url.search, { method: "DELETE" });
}

export const api = {
  projects: {
    async list() {
      return requestList<Project[]>("projects");
    },
    async upsert(project: Project) {
      return requestJson<Project>("/api/data/projects", { method: "POST", body: project });
    },
    async delete(projectId: string) {
      return requestDelete("projects", projectId);
    },
  },

  tasks: {
    async list() {
      return requestList<Task[]>("tasks");
    },
    async upsert(task: Task) {
      return requestJson<Task>("/api/data/tasks", { method: "POST", body: task });
    },
    async delete(taskId: string) {
      return requestDelete("tasks", taskId);
    },
  },

  todoItems: {
    async list() {
      return requestList<TodoItem[]>("todo-items");
    },
    async upsert(todoItem: TodoItem) {
      return requestJson<TodoItem>("/api/data/todo-items", { method: "POST", body: todoItem });
    },
    async delete(todoItemId: string) {
      return requestDelete("todo-items", todoItemId);
    },
  },

  plans: {
    async list(date: string) {
      return requestList<PlanItem[]>("plans", { date });
    },
    async upsert(date: string, plan: PlanItem) {
      const url = new URL("/api/data/plans", window.location.origin);
      url.searchParams.set("date", date);
      return requestJson<PlanItem>(url.pathname + url.search, { method: "POST", body: plan });
    },
    async delete(planId: string) {
      return requestDelete("plans", planId);
    },
  },

  sessions: {
    async list(range?: { start: string; end: string }) {
      return requestList<FocusSession[]>("sessions", range);
    },
    async upsert(session: FocusSession) {
      return requestJson<FocusSession>("/api/data/sessions", { method: "POST", body: session });
    },
    async delete(sessionId: string) {
      return requestDelete("sessions", sessionId);
    },
  },

  settings: {
    async get() {
      const settings = await requestJson<TimerSettings>("/api/data/settings");
      return settings ?? defaultSettings;
    },
    async update(settings: TimerSettings) {
      return requestJson<TimerSettings>("/api/data/settings", { method: "POST", body: settings });
    },
  },
};
