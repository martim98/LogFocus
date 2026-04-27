"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, FolderOpen, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { cn, formatMinutes } from "@/lib/utils";
import { useTodoItems } from "@/lib/hooks";
import type { TodoItem } from "@/lib/domain";
import { sortTodoItems } from "@/lib/resource-helpers";

const urgencyOptions: TodoItem["urgency"][] = [0, 0.5, 1, 2];

function getDangerState(item: TodoItem) {
  if (item.urgency !== 0 && item.urgency !== 0.5) return false;

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(18, 0, 0, 0);
  const finishTime = new Date(now.getTime() + item.hours * 60 * 60 * 1000);
  return finishTime > cutoff;
}

export function TodoListView() {
  const { todoItems, error, addTodoItem, updateTodoItem, deleteTodoItem } = useTodoItems();
  const [project, setProject] = useState("");
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState("1");
  const [urgency, setUrgency] = useState<TodoItem["urgency"]>(0.5);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TodoItem | null>(null);

  const orderedTodoItems = useMemo(() => sortTodoItems(todoItems), [todoItems]);
  const activeTodoItems = useMemo(() => orderedTodoItems.filter((item) => !item.completed), [orderedTodoItems]);
  const stats = useMemo(() => {
    const dangerousItems = activeTodoItems.filter((item) => getDangerState(item));
    const totalHours = activeTodoItems.reduce((sum, item) => sum + item.hours, 0);
    const activeProjects = new Set(activeTodoItems.map((item) => item.project.trim().toLowerCase()).filter(Boolean));
    return {
      openItems: activeTodoItems.length,
      doneItems: orderedTodoItems.length - activeTodoItems.length,
      dangerousItems: dangerousItems.length,
      totalHours,
      activeProjects: activeProjects.size,
    };
  }, [activeTodoItems, orderedTodoItems]);
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
            <p className="text-sm uppercase tracking-[0.24em] text-[rgb(var(--muted))]">To-do list</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Independent work queue.</h1>
            <p className="mt-3 max-w-2xl text-sm text-[rgb(var(--muted))]">
              Keep this separate from session logging, but make it sharper: active tasks stay visible, completed ones disappear from the queue, and the list stays ordered by urgency and effort.
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
                      <span className="rounded-full border border-[rgba(var(--line),0.45)] px-2.5 py-1">Urgency {nextUp.urgency}</span>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-[rgb(var(--muted))]">No active tasks in the queue.</p>
                )}
              </div>

              <div className="rounded-[24px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-4">
                <div className="flex items-center gap-2 text-[rgb(var(--muted))]">
                  <Clock3 className="h-4 w-4" />
                  <span className="text-[11px] uppercase tracking-[0.18em]">Load</span>
                </div>
                <p className="mt-3 text-lg font-semibold">{formatMinutes(Math.round(stats.totalHours * 60))}</p>
                <p className="mt-1 text-sm text-[rgb(var(--muted))]">{stats.openItems} active tasks across {stats.activeProjects} projects</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[24px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Active</p>
              <p className="mt-1 text-2xl font-semibold">{stats.openItems}</p>
            </div>
            <div className="rounded-[24px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Completed</p>
              <p className="mt-1 text-2xl font-semibold">{stats.doneItems}</p>
            </div>
            <div className="rounded-[24px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted))]">At Risk</p>
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
          <p className="text-sm text-[rgb(var(--muted))]">Project, task name, estimate, and urgency stay explicit so the queue remains easy to scan.</p>
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
                Urgency {option}
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
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">Only open tasks appear here. Finish one and it drops out immediately.</p>
          </div>
          <span className="rounded-full border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.18)] px-3 py-1 text-xs text-[rgb(var(--muted))]">
            {activeTodoItems.length} active
          </span>
        </div>

        <div className="hidden lg:block">
          <table className="min-w-full divide-y divide-[rgb(var(--line))] text-left text-sm">
            <thead className="bg-[rgba(var(--panel),0.4)]">
              <tr>
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Task</th>
                <th className="px-5 py-3 font-medium">Hours</th>
                <th className="px-5 py-3 font-medium">Urgency</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--line))] bg-[rgba(var(--panel),0.64)]">
              {activeTodoItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-[rgb(var(--muted))]">
                    No active to-do items. Add one above.
                  </td>
                </tr>
              ) : (
                activeTodoItems.map((item, index) => {
                  const danger = getDangerState(item);
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "transition",
                        danger ? "bg-[rgba(239,68,68,0.12)]" : index === 0 ? "bg-[rgba(var(--accent),0.08)]" : "hover:bg-white/5",
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-[rgb(var(--muted))]" />
                          <span>{item.project}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-medium">
                        <div className="flex items-center gap-2">
                          {index === 0 && <span className="rounded-full bg-[rgba(var(--accent-strong),0.18)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[rgb(var(--accent-strong))]">Next</span>}
                          <span>{item.title}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 tabular-nums">
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-[rgb(var(--muted))]" />
                          <span>{formatMinutes(Math.round(item.hours * 60))}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 tabular-nums">{item.urgency}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[rgba(var(--line),0.18)] px-2.5 py-1 text-xs font-medium text-[rgb(var(--muted))]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Open
                          </span>
                          <span
                            className={cn(
                              "inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium",
                              danger
                                ? "bg-[rgba(239,68,68,0.16)] text-red-200"
                                : "bg-[rgba(var(--line),0.18)] text-[rgb(var(--muted))]",
                            )}
                          >
                            {danger && <AlertTriangle className="h-3.5 w-3.5" />}
                            {danger ? "Danger" : "OK"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void updateTodoItem(item.id, { completed: !item.completed })}
                            className={buttonBaseClassName}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {item.completed ? "Reopen" : "Done"}
                          </button>
                          <button type="button" onClick={() => beginEdit(item)} className={buttonBaseClassName}>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button type="button" onClick={() => deleteTodoItem(item.id)} className={cn(buttonBaseClassName, "text-red-200")}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 px-4 py-4 lg:hidden">
          {activeTodoItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[rgba(var(--line),0.5)] px-4 py-8 text-sm text-[rgb(var(--muted))]">
              No active to-do items. Add one above.
            </div>
          ) : (
            activeTodoItems.map((item, index) => {
              const danger = getDangerState(item);
              return (
                <article
                  key={item.id}
                  className={cn(
                    "rounded-2xl border px-4 py-4 transition",
                    item.completed
                      ? "border-[rgba(var(--line),0.45)] bg-[rgba(var(--line),0.08)] opacity-75"
                      : danger
                        ? "border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)]"
                        : "border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{item.project}</p>
                      <div className="mt-1 flex items-center gap-2">
                        {index === 0 && <span className="rounded-full bg-[rgba(var(--accent-strong),0.18)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[rgb(var(--accent-strong))]">Next</span>}
                        <h3 className="text-base font-semibold tracking-tight">{item.title}</h3>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded-full border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.18)] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[rgb(var(--muted))]">
                        {formatMinutes(Math.round(item.hours * 60))}
                      </span>
                      <span className="rounded-full border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.18)] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[rgb(var(--muted))]">
                        Urgency {item.urgency}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                        "bg-[rgba(var(--line),0.18)] text-[rgb(var(--muted))]",
                      )}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Open
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                        danger ? "bg-[rgba(239,68,68,0.16)] text-red-200" : "bg-[rgba(var(--line),0.18)] text-[rgb(var(--muted))]",
                      )}
                    >
                      {danger && <AlertTriangle className="h-3.5 w-3.5" />}
                      {danger ? "Danger" : "OK"}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void updateTodoItem(item.id, { completed: !item.completed })} className={buttonBaseClassName}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {item.completed ? "Reopen" : "Done"}
                    </button>
                    <button type="button" onClick={() => beginEdit(item)} className={buttonBaseClassName}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteTodoItem(item.id)} className={cn(buttonBaseClassName, "text-red-200")}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
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
                  Urgency {option}
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
