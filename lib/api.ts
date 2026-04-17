import { defaultSettings } from "./domain";
import type { FocusSession, PlanItem, Project, TodoItem, Task, TimerSettings } from "./domain";

type RequestInitWithBody = Omit<RequestInit, "body"> & {
  body?: unknown;
};

type ResourceConfig = {
  path: string;
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

function withQuery(path: string, query?: Record<string, string | undefined>) {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.pathname + url.search;
}

function createCollectionApi<TList, TWrite = TList>(config: ResourceConfig) {
  return {
    async list(query?: Record<string, string | undefined>) {
      return requestJson<TList>(withQuery(config.path, query));
    },
    async upsert(item: TWrite) {
      return requestJson<TWrite>(config.path, { method: "POST", body: item });
    },
    async delete(id: string) {
      return requestJson<{ ok: true }>(withQuery(config.path, { id }), { method: "DELETE" });
    },
  };
}

export const resourceDefinitions = {
  projects: { path: "/api/data/projects" },
  tasks: { path: "/api/data/tasks" },
  todoItems: { path: "/api/data/todo-items" },
  plans: { path: "/api/data/plans" },
  sessions: { path: "/api/data/sessions" },
  settings: { path: "/api/data/settings" },
} as const;

export const api = {
  projects: createCollectionApi<Project[], Project>(resourceDefinitions.projects),
  tasks: createCollectionApi<Task[], Task>(resourceDefinitions.tasks),
  todoItems: createCollectionApi<TodoItem[], TodoItem>(resourceDefinitions.todoItems),
  plans: {
    async list(date: string) {
      return requestJson<PlanItem[]>(withQuery(resourceDefinitions.plans.path, { date }));
    },
    async upsert(date: string, plan: PlanItem) {
      return requestJson<PlanItem>(withQuery(resourceDefinitions.plans.path, { date }), { method: "POST", body: plan });
    },
    async delete(planId: string) {
      return requestJson<{ ok: true }>(withQuery(resourceDefinitions.plans.path, { id: planId }), { method: "DELETE" });
    },
  },
  sessions: {
    async list(range?: { start: string; end: string }) {
      return requestJson<FocusSession[]>(withQuery(resourceDefinitions.sessions.path, range));
    },
    async upsert(session: FocusSession) {
      return requestJson<FocusSession>(resourceDefinitions.sessions.path, { method: "POST", body: session });
    },
    async delete(sessionId: string) {
      return requestJson<{ ok: true }>(withQuery(resourceDefinitions.sessions.path, { id: sessionId }), { method: "DELETE" });
    },
  },
  settings: {
    async get() {
      const settings = await requestJson<TimerSettings>(resourceDefinitions.settings.path);
      return settings ?? defaultSettings;
    },
    async update(settings: TimerSettings) {
      return requestJson<TimerSettings>(resourceDefinitions.settings.path, { method: "POST", body: settings });
    },
  },
};
