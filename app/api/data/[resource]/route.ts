import { NextRequest, NextResponse } from "next/server";
import {
  getDefaultProject,
  getDefaultSettings,
  getStore,
  parseAndValidatePlan,
  parseAndValidateProject,
  parseAndValidateSession,
  parseAndValidateSettings,
  parseAndValidateTask,
  parseAndValidateTodoItem,
  updateStore,
} from "@/lib/local-store";
import { sortByOrder, sortSessionsNewestFirst, sortTodoItems, stripPlanDate } from "@/lib/resource-helpers";

type RouteContext = {
  params: Promise<{
    resource: string;
  }>;
};

type RouteDefinition<TParsed> = {
  list: (request: NextRequest, store: Awaited<ReturnType<typeof getStore>>) => unknown;
  parse?: (body: unknown) => TParsed;
  upsert?: (store: Awaited<ReturnType<typeof getStore>>, parsed: TParsed, request: NextRequest) => void;
  remove?: (store: Awaited<ReturnType<typeof getStore>>, id: string) => void;
};

function notFound() {
  return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
}

const routeDefinitions: Record<string, RouteDefinition<any>> = {
  projects: {
    list: (_request, store) => (store.data.projects.length > 0 ? sortByOrder(store.data.projects) : [getDefaultProject()]),
    parse: parseAndValidateProject,
    upsert: (store, project) => {
      const index = store.data.projects.findIndex((item) => item.id === project.id);
      if (index >= 0) {
        store.data.projects[index] = project;
      } else {
        store.data.projects.push(project);
      }
    },
    remove: (store, id) => {
      store.data.projects = store.data.projects.filter((item) => item.id !== id);
    },
  },
  tasks: {
    list: (_request, store) => sortByOrder(store.data.tasks),
    parse: parseAndValidateTask,
    upsert: (store, task) => {
      const index = store.data.tasks.findIndex((item) => item.id === task.id);
      if (index >= 0) {
        store.data.tasks[index] = task;
      } else {
        store.data.tasks.push(task);
      }
    },
    remove: (store, id) => {
      store.data.tasks = store.data.tasks.filter((item) => item.id !== id);
    },
  },
  "todo-items": {
    list: (_request, store) => sortTodoItems(store.data.todoItems),
    parse: parseAndValidateTodoItem,
    upsert: (store, todoItem) => {
      const index = store.data.todoItems.findIndex((item) => item.id === todoItem.id);
      if (index >= 0) {
        store.data.todoItems[index] = todoItem;
      } else {
        store.data.todoItems.push(todoItem);
      }
    },
    remove: (store, id) => {
      store.data.todoItems = store.data.todoItems.filter((item) => item.id !== id);
    },
  },
  plans: {
    list: (request, store) => {
      const url = new URL(request.url);
      const date = url.searchParams.get("date");
      const items = date ? store.data.plans.filter((item) => item.date === date) : store.data.plans;
      return sortByOrder(items).map(stripPlanDate);
    },
    parse: parseAndValidatePlan,
    upsert: (store, plan, request) => {
      const url = new URL(request.url);
      const date = url.searchParams.get("date");
      if (!date) {
        throw new Error("Missing date.");
      }
      const stored = { ...plan, date };
      const index = store.data.plans.findIndex((item) => item.id === plan.id);
      if (index >= 0) {
        store.data.plans[index] = stored;
      } else {
        store.data.plans.push(stored);
      }
    },
    remove: (store, id) => {
      store.data.plans = store.data.plans.filter((item) => item.id !== id);
    },
  },
  sessions: {
    list: (request, store) => {
      const url = new URL(request.url);
      const start = url.searchParams.get("start");
      const end = url.searchParams.get("end");
      const items = store.data.sessions.filter((session) => {
        if (start && session.startedAt < start) return false;
        if (end && session.startedAt > end) return false;
        return true;
      });
      return sortSessionsNewestFirst(items);
    },
    parse: parseAndValidateSession,
    upsert: (store, session) => {
      const index = store.data.sessions.findIndex((item) => item.id === session.id);
      if (index >= 0) {
        store.data.sessions[index] = session;
      } else {
        store.data.sessions.push(session);
      }
    },
    remove: (store, id) => {
      store.data.sessions = store.data.sessions.filter((item) => item.id !== id);
    },
  },
  settings: {
    list: (_request, store) => store.data.settings ?? getDefaultSettings(),
    parse: parseAndValidateSettings,
    upsert: (store, settings) => {
      store.data.settings = settings;
    },
  },
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { resource } = await context.params;
  const routeDefinition = routeDefinitions[resource];
  if (!routeDefinition) {
    return notFound();
  }

  const store = await getStore();
  return NextResponse.json(routeDefinition.list(request, store));
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { resource } = await context.params;
  const routeDefinition = routeDefinitions[resource];
  if (!routeDefinition?.parse || !routeDefinition.upsert) {
    return notFound();
  }

  const body = await request.json();

  try {
    const parsed = routeDefinition.parse(body);
    await updateStore((store) => {
      routeDefinition.upsert?.(store, parsed, request);
    });
    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { resource } = await context.params;
  const routeDefinition = routeDefinitions[resource];
  if (!routeDefinition?.remove) {
    return notFound();
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  await updateStore((store) => {
    routeDefinition.remove?.(store, id);
  });
  return NextResponse.json({ ok: true });
}
