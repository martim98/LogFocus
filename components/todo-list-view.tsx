"use client";

import { FormEvent, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock3, FolderOpen, Pencil, Play, Plus, Sparkles, Trash2 } from "lucide-react";
import { cn, formatMinutes, getDateKey } from "@/lib/utils";
import { useProjects, useSessions, useTodoItems } from "@/lib/hooks";
import type { TodoItem } from "@/lib/domain";
import { sortTodoItems } from "@/lib/resource-helpers";
import { getTodoItemTimeLogged, getTodoItemTimeLoggedToday } from "@/lib/analytics";
import { useAppStore } from "@/lib/store";

const urgencyOptions: TodoItem["urgency"][] = [0, 0.5, 1, 2];
const urgencyLabels: Record<TodoItem["urgency"], string> = {
  0: "Critical",
  0.5: "Today",
  1: "Soon",
  2: "Later",
};

type TodoTiming = {
  plannedMinutes: number;
  totalMinutes: number;
  todayMinutes: number;
  progressPercent: number;
  overEstimate: boolean;
};

function getDangerState(item: TodoItem) {
  if (item.urgency !== 0 && item.urgency !== 0.5) return false;

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(18, 0, 0, 0);
  const finishTime = new Date(now.getTime() + item.hours * 60 * 60 * 1000);
  return finishTime > cutoff;
}

function getUrgencyLabel(value: TodoItem["urgency"]) {
  return urgencyLabels[value] ?? `Urgency ${value}`;
}

function getTodoTiming(item: TodoItem, timing: Pick<TodoTiming, "totalMinutes" | "todayMinutes">): TodoTiming {
  const plannedMinutes = Math.max(1, Math.round(item.hours * 60));
  const progressPercent = Math.min(100, Math.round((timing.totalMinutes / plannedMinutes) * 100));
  return {
    plannedMinutes,
    totalMinutes: timing.totalMinutes,
    todayMinutes: timing.todayMinutes,
    progressPercent,
    overEstimate: timing.totalMinutes > plannedMinutes,
  };
}

export function TodoListView() {
  const { todoItems, error, addTodoItem, updateTodoItem, deleteTodoItem } = useTodoItems();
  const { projects } = useProjects();
  const { sessions } = useSessions();
  const activeTodoItemId = useAppStore((state) => state.activeTodoItemId);
  const [project, setProject] = useState("");
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState("1");
  const [urgency, setUrgency] = useState<TodoItem["urgency"]>(0.5);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TodoItem | null>(null);

  const orderedTodoItems = useMemo(() => sortTodoItems(todoItems), [todoItems]);
  const activeTodoItems = useMemo(() => orderedTodoItems.filter((item) => !item.completed), [orderedTodoItems]);
  const completedTodoItems = useMemo(() => orderedTodoItems.filter((item) => item.completed), [orderedTodoItems]);
  const todayKey = getDateKey();
  const projectIdByTitle = useMemo(
    () => new Map(projects.map((entry) => [entry.title.trim().toLowerCase(), entry.id])),
    [projects],
  );
  const timeByTodoId = useMemo(
    () =>
      new Map(
        todoItems.map((item) => [
          item.id,
          {
            totalMinutes: getTodoItemTimeLogged(item.id, sessions),
            todayMinutes: getTodoItemTimeLoggedToday(item.id, sessions, getDateKey()),
          },
        ]),
      ),
    [todoItems, sessions, todayKey],
  );
  const stats = useMemo(() => {
    const dangerousItems = activeTodoItems.filter((item) => getDangerState(item));
    const totalHours = activeTodoItems.reduce((sum, item) => sum + item.hours, 0);
    const activeProjects = new Set(activeTodoItems.map((item) => item.project.trim().toLowerCase()).filter(Boolean));
    const todayMinutes = activeTodoItems.reduce((sum, item) => {
      const timing = timeByTodoId.get(item.id);
      return sum + (timing?.todayMinutes ?? 0);
    }, 0);
    return {
      openItems: activeTodoItems.length,
      doneItems: completedTodoItems.length,
      dangerousItems: dangerousItems.length,
      totalHours,
      activeProjects: activeProjects.size,
      todayMinutes,
    };
  }, [activeTodoItems, completedTodoItems.length, timeByTodoId]);
  const nextUp = activeTodoItems[0] ?? null;

  const fieldClassName =
    "min-w-0 rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-all focus:border-[rgb(var(--accent))] focus:bg-[rgba(var(--bg),0.3)]";
  const buttonBaseClassName =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.2)] px-3 py-2 text-xs font-medium transition-all hover:bg-[rgba(var(--bg),0.32)] active:scale-[0.98]";
  const primaryButtonClassName =
    "inline-flex items-center justify-center gap-2 rounded-2xl bg-[rgb(var(--accent-strong))] px-4 py-3 text-sm font-semibold text-slate-950 transition-all hover:brightness-105 active:scale-[0.98]";

  async function onAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedProject = project.trim();
    const trimmedTitle = title.trim();
    const parsedHours = Number(hours);
    if (!trimmedProject || !trimmedTitle || Number.isNaN(parsedHours) || parsedHours <= 0) return;
    const savedId = await addTodoItem({
      project: trimmedProject,
      title: trimmedTitle,
      hours: parsedHours,
      urgency,
      projectId: projectIdByTitle.get(trimmedProject.toLowerCase()) ?? null,
    });
    if (savedId) {
      setProject("");
      setTitle("");
      setHours("1");
      setUrgency(0.5);
    }
  }

  function beginEdit(item: TodoItem) {
    setEditingId(item.id);
    setDraft(item);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || !draft) return;
    const trimmedProject = draft.project.trim();
    const trimmedTitle = draft.title.trim();
    if (!trimmedProject || !trimmedTitle || Number.isNaN(draft.hours) || draft.hours <= 0) return;
    const saved = await updateTodoItem(editingId, {
      project: trimmedProject,
      title: trimmedTitle,
      hours: draft.hours,
      urgency: draft.urgency,
      projectId: projectIdByTitle.get(trimmedProject.toLowerCase()) ?? null,
    });
    if (saved) {
      setEditingId(null);
      setDraft(null);
    }
  }

  return (
    <main className="flex flex-col gap-6 pb-12">
      <section className="panel relative overflow-hidden rounded-[32px] p-6 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(135deg,rgba(var(--accent),0.22),rgba(255,255,255,0))]" />
        <div className="relative grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Planning labels</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Work Queue</h1>
            <p className="mt-3 max-w-2xl text-sm text-[rgb(var(--muted))]">
              Plan work items here and review their tracked effort. PSA timer task categories stay separate for export and billing accuracy.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-4">
                <div className="flex items-center gap-2 text-[rgb(var(--muted))]">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-[11px] uppercase tracking-[0.18em]">Next up</span>
                </div>
                {nextUp ? (
                  <>
                    <p className="mt-3 text-lg font-semibold">{nextUp.title}</p>
                    <p className="mt-1 text-sm text-[rgb(var(--muted))]">{nextUp.project}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[rgb(var(--muted))]">
                      <span className="rounded-full border border-[rgba(var(--line),0.45)] px-2.5 py-1">{formatMinutes(Math.round(nextUp.hours * 60))}</span>
                      <span className="rounded-full border border-[rgba(var(--line),0.45)] px-2.5 py-1">{getUrgencyLabel(nextUp.urgency)}</span>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-[rgb(var(--muted))]">No active work items in the queue.</p>
                )}
              </div>

              <div className="rounded-[24px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-4">
                <div className="flex items-center gap-2 text-[rgb(var(--muted))]">
                  <Clock3 className="h-4 w-4" />
                  <span className="text-[11px] uppercase tracking-[0.18em]">Planned load</span>
                </div>
                <p className="mt-3 text-lg font-semibold">{formatMinutes(Math.round(stats.totalHours * 60))}</p>
                <p className="mt-1 text-sm text-[rgb(var(--muted))]">
                  {stats.openItems} active items across {stats.activeProjects} projects
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[24px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Active</p>
              <p className="mt-1 text-2xl font-semibold">{stats.openItems}</p>
            </div>
            <div className="rounded-[24px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Tracked today</p>
              <p className="mt-1 text-2xl font-semibold">{formatMinutes(stats.todayMinutes)}</p>
            </div>
            <div className="rounded-[24px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Completed</p>
              <p className="mt-1 text-2xl font-semibold">{stats.doneItems}</p>
            </div>
            <div className="rounded-[24px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted))]">At risk</p>
              <p className="mt-1 text-2xl font-semibold">{stats.dangerousItems}</p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <section className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          Save failed: {error}
        </section>
      )}

      <section className="panel rounded-[32px] p-6 sm:p-7">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold tracking-tight">Add to the queue</h2>
          <p className="text-sm text-[rgb(var(--muted))]">
            Project, work item, estimate, and urgency stay explicit. Timer task categories are still selected separately in Today.
          </p>
        </div>
        <form onSubmit={onAddItem} className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_1.1fr_0.75fr_0.75fr_auto]">
          <input
            value={project}
            onChange={(event) => setProject(event.currentTarget.value)}
            placeholder="Project"
            autoComplete="off"
            className={fieldClassName}
          />
          <input
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            placeholder="Task name"
            autoComplete="off"
            className={fieldClassName}
          />
          <input
            value={hours}
            onChange={(event) => setHours(event.currentTarget.value)}
            type="number"
            min="0.1"
            step="0.1"
            placeholder="Hours"
            className={fieldClassName}
          />
          <select
            value={urgency}
            onChange={(event) => setUrgency(Number(event.currentTarget.value) as TodoItem["urgency"])}
            className={fieldClassName}
          >
            {urgencyOptions.map((option) => (
              <option key={option} value={option}>
                {getUrgencyLabel(option)}
              </option>
            ))}
          </select>
          <button type="submit" className={primaryButtonClassName}>
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>
      </section>

      <section className="panel overflow-hidden rounded-[32px]">
        <div className="flex items-center justify-between gap-3 border-b border-[rgb(var(--line))] bg-[rgba(var(--accent),0.06)] px-5 py-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--muted))]">Active queue</h2>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">Open planning labels only. PSA task categories remain separate.</p>
          </div>
          <span className="rounded-full border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.18)] px-3 py-1 text-xs text-[rgb(var(--muted))]">
            {activeTodoItems.length} active
          </span>
        </div>

        <div className="grid gap-3 px-4 py-4">
          {activeTodoItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[rgba(var(--line),0.5)] px-4 py-8 text-sm text-[rgb(var(--muted))]">
              No active to-do items. Add one above.
            </div>
          ) : (
            activeTodoItems.map((item, index) => {
              const danger = getDangerState(item);
              const timing = getTodoTiming(item, timeByTodoId.get(item.id) ?? { totalMinutes: 0, todayMinutes: 0 });
              const isActive = activeTodoItemId === item.id;
              return (
                <TodoItemCard
                  key={item.id}
                  item={item}
                  timing={timing}
                  isNext={index === 0}
                  isActive={isActive}
                  isAtRisk={danger}
                  actions={
                    <TodoItemActions
                      item={item}
                      buttonClassName={buttonBaseClassName}
                      onToggleComplete={(nextItem) => void updateTodoItem(nextItem.id, { completed: !nextItem.completed })}
                      onEdit={beginEdit}
                      onDelete={(nextItem) => void deleteTodoItem(nextItem.id)}
                    />
                  }
                />
              );
            })
          )}
        </div>
      </section>

      <section className="panel overflow-hidden rounded-[32px]">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-[rgb(var(--line))] bg-[rgba(var(--panel),0.42)] px-5 py-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--muted))]">Completed</h2>
              <p className="mt-1 text-sm text-[rgb(var(--muted))]">Done planning labels remain available for review, edit, or reopen.</p>
            </div>
            <span className="rounded-full border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.18)] px-3 py-1 text-xs text-[rgb(var(--muted))]">
              {completedTodoItems.length} done
            </span>
          </summary>
          <div className="grid gap-3 px-4 py-4">
            {completedTodoItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[rgba(var(--line),0.5)] px-4 py-8 text-sm text-[rgb(var(--muted))]">
                No completed to-do items yet.
              </div>
            ) : (
              completedTodoItems.map((item) => {
                const timing = getTodoTiming(item, timeByTodoId.get(item.id) ?? { totalMinutes: 0, todayMinutes: 0 });
                return (
                  <TodoItemCard
                    key={item.id}
                    item={item}
                    timing={timing}
                    isNext={false}
                    isActive={activeTodoItemId === item.id}
                    isAtRisk={false}
                    completed
                    actions={
                      <TodoItemActions
                        item={item}
                        buttonClassName={buttonBaseClassName}
                        onToggleComplete={(nextItem) => void updateTodoItem(nextItem.id, { completed: !nextItem.completed })}
                        onEdit={beginEdit}
                        onDelete={(nextItem) => void deleteTodoItem(nextItem.id)}
                      />
                    }
                  />
                );
              })
            )}
          </div>
        </details>
      </section>

      {draft && editingId && (
        <section className="panel rounded-[32px] p-6 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[rgb(var(--muted))]">Editing</p>
              <h2 className="mt-2 text-xl font-semibold">{draft.title}</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setDraft(null);
              }}
              className="text-sm text-[rgb(var(--muted))] transition hover:text-white"
            >
              Cancel
            </button>
          </div>
          <form onSubmit={saveEdit} className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_1.1fr_0.75fr_0.75fr_auto]">
            <input
              value={draft.project}
              onChange={(event) => setDraft({ ...draft, project: event.currentTarget.value })}
              className={fieldClassName}
            />
            <input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.currentTarget.value })}
              className={fieldClassName}
            />
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={draft.hours}
              onChange={(event) => setDraft({ ...draft, hours: Number(event.currentTarget.value) })}
              className={fieldClassName}
            />
            <select
              value={draft.urgency}
              onChange={(event) => setDraft({ ...draft, urgency: Number(event.currentTarget.value) as TodoItem["urgency"] })}
              className={fieldClassName}
            >
              {urgencyOptions.map((option) => (
                <option key={option} value={option}>
                  {getUrgencyLabel(option)}
                </option>
              ))}
            </select>
            <button type="submit" className={primaryButtonClassName}>
              Save
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

function TodoItemCard({
  item,
  timing,
  isNext,
  isActive,
  isAtRisk,
  completed = false,
  actions,
}: {
  item: TodoItem;
  timing: TodoTiming;
  isNext: boolean;
  isActive: boolean;
  isAtRisk: boolean;
  completed?: boolean;
  actions: ReactNode;
}) {
  return (
    <article
      className={cn(
        "grid gap-4 rounded-2xl border px-4 py-4 transition lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)_auto] lg:items-center",
        completed
          ? "border-[rgba(var(--line),0.38)] bg-[rgba(var(--line),0.07)] opacity-85"
          : isActive
            ? "border-[rgba(var(--accent-strong),0.7)] bg-[rgba(var(--accent),0.12)]"
            : isAtRisk
              ? "border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)]"
              : isNext
                ? "border-[rgba(var(--accent),0.38)] bg-[rgba(var(--accent),0.08)]"
                : "border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)]",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {isNext ? <StatusPill tone="accent">Next</StatusPill> : null}
          {completed ? <StatusPill>Done</StatusPill> : <StatusPill>Open</StatusPill>}
          {isActive ? (
            <StatusPill tone="active">
              <Play className="h-3.5 w-3.5" />
              Active
            </StatusPill>
          ) : null}
          <StatusPill>{getUrgencyLabel(item.urgency)}</StatusPill>
          {isAtRisk ? (
            <StatusPill tone="risk" title="Estimate may run past 18:00">
              <AlertTriangle className="h-3.5 w-3.5" />
              At risk
            </StatusPill>
          ) : null}
        </div>

        <h3 className="mt-3 truncate text-base font-semibold tracking-tight text-white sm:text-lg">{item.title}</h3>
        <p className="mt-1 flex min-w-0 items-center gap-2 truncate text-sm text-[rgb(var(--muted))]">
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.project}</span>
        </p>
      </div>

      <TodoProgress timing={timing} />

      <div className="flex flex-wrap justify-start gap-2 lg:justify-end">{actions}</div>
    </article>
  );
}

function TodoProgress({ timing }: { timing: TodoTiming }) {
  return (
    <div className="rounded-2xl border border-[rgba(var(--line),0.35)] bg-[rgba(var(--bg),0.16)] px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[rgb(var(--muted))]">Tracked / planned</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {formatMinutes(timing.totalMinutes)} / {formatMinutes(timing.plannedMinutes)}
          </p>
        </div>
        {timing.overEstimate ? (
          <span className="shrink-0 rounded-full bg-[rgba(239,68,68,0.14)] px-2.5 py-1 text-[10px] font-medium text-red-200">
            Over estimate
          </span>
        ) : null}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(var(--line),0.28)]">
        <div
          className={cn("h-full rounded-full", timing.overEstimate ? "bg-red-300" : "bg-[rgb(var(--accent-strong))]")}
          style={{ width: `${timing.progressPercent}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-[rgb(var(--muted))]">
        <span>Today {formatMinutes(timing.todayMinutes)}</span>
        <span>{timing.progressPercent}%</span>
      </div>
    </div>
  );
}

function StatusPill({
  children,
  tone,
  title,
}: {
  children: ReactNode;
  tone?: "accent" | "active" | "risk";
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "accent"
          ? "bg-[rgba(var(--accent-strong),0.18)] text-[rgb(var(--accent-strong))]"
          : tone === "active"
            ? "bg-[rgba(var(--accent),0.18)] text-white"
            : tone === "risk"
              ? "bg-[rgba(239,68,68,0.16)] text-red-200"
              : "bg-[rgba(var(--line),0.18)] text-[rgb(var(--muted))]",
      )}
    >
      {children}
    </span>
  );
}

function TodoItemActions({
  item,
  buttonClassName,
  onToggleComplete,
  onEdit,
  onDelete,
}: {
  item: TodoItem;
  buttonClassName: string;
  onToggleComplete: (item: TodoItem) => void;
  onEdit: (item: TodoItem) => void;
  onDelete: (item: TodoItem) => void;
}) {
  return (
    <>
      <button type="button" onClick={() => onToggleComplete(item)} className={buttonClassName}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        {item.completed ? "Reopen" : "Done"}
      </button>
      <button type="button" onClick={() => onEdit(item)} className={buttonClassName}>
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </button>
      <button type="button" onClick={() => onDelete(item)} className={cn(buttonClassName, "text-red-200")}>
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>
    </>
  );
}
