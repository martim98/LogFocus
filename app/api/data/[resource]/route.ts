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

type RouteContext = {
  params: Promise<{
    resource: string;
  }>;
};

function notFound() {
  return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
}

function sortByOrder<T extends { order: number }>(items: T[]) {
  return items.slice().sort((a, b) => a.order - b.order);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { resource } = await context.params;
  const store = await getStore();
  const url = new URL(request.url);

  switch (resource) {
    case "projects":
      return NextResponse.json(store.data.projects.length > 0 ? sortByOrder(store.data.projects) : [getDefaultProject()]);
    case "tasks":
      return NextResponse.json(sortByOrder(store.data.tasks));
    case "todo-items":
      return NextResponse.json(
        store.data.todoItems
          .slice()
          .sort((a, b) => a.urgency - b.urgency || a.hours - b.hours || b.createdAt.localeCompare(a.createdAt)),
      );
    case "plans": {
      const date = url.searchParams.get("date");
      const items = date ? store.data.plans.filter((item) => item.date === date) : store.data.plans;
      return NextResponse.json(
        sortByOrder(items).map((plan) => {
          const { date, ...rest } = plan;
          void date;
          return rest;
        }),
      );
    }
    case "sessions": {
      const start = url.searchParams.get("start");
      const end = url.searchParams.get("end");
      const items = store.data.sessions.filter((session) => {
        if (start && session.startedAt < start) return false;
        if (end && session.startedAt > end) return false;
        return true;
      });
      return NextResponse.json(items.slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
    }
    case "settings":
      return NextResponse.json(store.data.settings ?? getDefaultSettings());
    default:
      return notFound();
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { resource } = await context.params;
  const body = await request.json();
  const url = new URL(request.url);

  try {
    switch (resource) {
      case "projects": {
        const project = parseAndValidateProject(body);
        await updateStore((store) => {
          const index = store.data.projects.findIndex((item) => item.id === project.id);
          if (index >= 0) {
            store.data.projects[index] = project;
          } else {
            store.data.projects.push(project);
          }
        });
        return NextResponse.json(project);
      }
      case "tasks": {
        const task = parseAndValidateTask(body);
        await updateStore((store) => {
          const index = store.data.tasks.findIndex((item) => item.id === task.id);
          if (index >= 0) {
            store.data.tasks[index] = task;
          } else {
            store.data.tasks.push(task);
          }
        });
        return NextResponse.json(task);
      }
      case "todo-items": {
        const todoItem = parseAndValidateTodoItem(body);
        await updateStore((store) => {
          const index = store.data.todoItems.findIndex((item) => item.id === todoItem.id);
          if (index >= 0) {
            store.data.todoItems[index] = todoItem;
          } else {
            store.data.todoItems.push(todoItem);
          }
        });
        return NextResponse.json(todoItem);
      }
      case "plans": {
        const date = url.searchParams.get("date");
        if (!date) {
          return NextResponse.json({ error: "Missing date." }, { status: 400 });
        }
        const plan = parseAndValidatePlan(body);
        await updateStore((store) => {
          const index = store.data.plans.findIndex((item) => item.id === plan.id);
          const stored = { ...plan, date };
          if (index >= 0) {
            store.data.plans[index] = stored;
          } else {
            store.data.plans.push(stored);
          }
        });
        return NextResponse.json(plan);
      }
      case "sessions": {
        const session = parseAndValidateSession(body);
        await updateStore((store) => {
          const index = store.data.sessions.findIndex((item) => item.id === session.id);
          if (index >= 0) {
            store.data.sessions[index] = session;
          } else {
            store.data.sessions.push(session);
          }
        });
        return NextResponse.json(session);
      }
      case "settings": {
        const settings = parseAndValidateSettings(body);
        await updateStore((store) => {
          store.data.settings = settings;
        });
        return NextResponse.json(settings);
      }
      default:
        return notFound();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { resource } = await context.params;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  switch (resource) {
    case "projects":
      await updateStore((store) => {
        store.data.projects = store.data.projects.filter((item) => item.id !== id);
      });
      return NextResponse.json({ ok: true });
    case "tasks":
      await updateStore((store) => {
        store.data.tasks = store.data.tasks.filter((item) => item.id !== id);
      });
      return NextResponse.json({ ok: true });
    case "todo-items":
      await updateStore((store) => {
        store.data.todoItems = store.data.todoItems.filter((item) => item.id !== id);
      });
      return NextResponse.json({ ok: true });
    case "plans":
      await updateStore((store) => {
        store.data.plans = store.data.plans.filter((item) => item.id !== id);
      });
      return NextResponse.json({ ok: true });
    case "sessions":
      await updateStore((store) => {
        store.data.sessions = store.data.sessions.filter((item) => item.id !== id);
      });
      return NextResponse.json({ ok: true });
    default:
      return notFound();
  }
}
