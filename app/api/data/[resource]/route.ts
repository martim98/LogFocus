import { NextRequest, NextResponse } from "next/server";
import {
  getDefaultFocusRewards,
  getDefaultProject,
  getDefaultSettings,
  getStore,
  parseAndValidateFocusRewards,
  parseAndValidatePlan,
  parseAndValidateProject,
  parseAndValidateSession,
  parseAndValidateSettings,
  parseAndValidateTask,
  parseAndValidateTodoItem,
  updateStore,
} from "@/lib/local-store";
import { awardFocusSessionReward, normalizeLedgerForDate, removeFocusSessionReward, getRewardDateKey } from "@/lib/focus-rewards";
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

function upsertById<T extends { id: string }>(items: T[], item: T) {
  const index = items.findIndex((entry) => entry.id === item.id);
  if (index >= 0) {
    items[index] = item;
  } else {
    items.push(item);
  }
}

function removeById<T extends { id: string }>(items: T[], id: string) {
  return items.filter((item) => item.id !== id);
}

const routeDefinitions: Record<string, RouteDefinition<any>> = {
  projects: {
    list: (_request, store) => (store.data.projects.length > 0 ? sortByOrder(store.data.projects) : [getDefaultProject()]),
    parse: parseAndValidateProject,
    upsert: (store, project) => {
      upsertById(store.data.projects, project);
    },
    remove: (store, id) => {
      store.data.projects = removeById(store.data.projects, id);
    },
  },
  tasks: {
    list: (_request, store) => sortByOrder(store.data.tasks),
    parse: parseAndValidateTask,
    upsert: (store, task) => {
      upsertById(store.data.tasks, task);
    },
    remove: (store, id) => {
      store.data.tasks = removeById(store.data.tasks, id);
    },
  },
  "todo-items": {
    list: (_request, store) => sortTodoItems(store.data.todoItems),
    parse: parseAndValidateTodoItem,
    upsert: (store, todoItem) => {
      upsertById(store.data.todoItems, todoItem);
    },
    remove: (store, id) => {
      store.data.todoItems = removeById(store.data.todoItems, id);
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
      upsertById(store.data.plans, stored);
    },
    remove: (store, id) => {
      store.data.plans = removeById(store.data.plans, id);
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
      upsertById(store.data.sessions, session);
      store.data.focusRewards = awardFocusSessionReward(
        store.data.focusRewards ?? getDefaultFocusRewards(),
        session,
        store.data.settings ?? getDefaultSettings(),
        session.endedAt,
      );
    },
    remove: (store, id) => {
      store.data.sessions = removeById(store.data.sessions, id);
      store.data.focusRewards = removeFocusSessionReward(store.data.focusRewards ?? getDefaultFocusRewards(), id);
    },
  },
  settings: {
    list: (_request, store) => store.data.settings ?? getDefaultSettings(),
    parse: parseAndValidateSettings,
    upsert: (store, settings) => {
      store.data.settings = settings;
    },
  },
  "focus-rewards": {
    list: (_request, store) => normalizeLedgerForDate(store.data.focusRewards ?? getDefaultFocusRewards(), getRewardDateKey(new Date().toISOString())),
    parse: parseAndValidateFocusRewards,
    upsert: (store, focusRewards) => {
      store.data.focusRewards = focusRewards;
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
