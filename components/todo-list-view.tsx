"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, Pencil, Trash2 } from "lucide-react";
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
    const saved = await updateTodoItem(editingId, {
      project: draft.project.trim(),
      title: draft.title.trim(),
      hours: draft.hours,
      urgency: draft.urgency,
    });
    if (saved) {
      setEditingId(null);
      setDraft(null);
    }
  }

  return (
    <main className="flex flex-col gap-6">
      <section className="panel rounded-[28px] p-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[rgb(var(--muted))]">To-do list</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Independent task logging.</h1>
            <p className="mt-2 max-w-2xl text-sm text-[rgb(var(--muted))]">
              This list is separate from session logging. Add work items, sort them by urgency and hours, and edit them later without linking them to focus sessions.
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-sm text-[rgb(var(--muted))]">
            Danger for urgent overflow
          </div>
        </div>
      </section>

      {error && (
        <section className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          Save failed: {error}
        </section>
      )}

      <section className="panel rounded-[28px] p-6 sm:p-7">
        <form onSubmit={onAddItem} className="grid gap-3 lg:grid-cols-[1.1fr_1.1fr_0.7fr_0.7fr_auto]">
          <input
            value={project}
            onChange={(event) => setProject(event.currentTarget.value)}
            placeholder="Project"
            className="rounded-xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-sm"
          />
          <input
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            placeholder="Task name"
            className="rounded-xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-sm"
          />
          <input
            value={hours}
            onChange={(event) => setHours(event.currentTarget.value)}
            type="number"
            min="0.1"
            step="0.1"
            placeholder="Hours"
            className="rounded-xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-sm"
          />
          <select
            value={urgency}
            onChange={(event) => setUrgency(Number(event.currentTarget.value) as TodoItem["urgency"])}
            className="rounded-xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-sm"
          >
            {urgencyOptions.map((option) => (
              <option key={option} value={option}>
                Urgency {option}
              </option>
            ))}
          </select>
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent-strong))] px-4 py-3 text-sm font-medium text-white">
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>
      </section>

      <section className="panel overflow-hidden rounded-[28px]">
        <div className="border-b border-[rgb(var(--line))] bg-[rgba(var(--accent),0.05)] px-5 py-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--muted))]">To-do items</h2>
        </div>
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
            {orderedTodoItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-[rgb(var(--muted))]">
                  No to-do items yet. Add the first item above.
                </td>
              </tr>
            ) : (
              orderedTodoItems.map((item) => {
                const danger = getDangerState(item);
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "transition",
                      item.completed ? "bg-[rgba(var(--line),0.08)] opacity-70" : danger ? "bg-[rgba(239,68,68,0.12)]" : "hover:bg-white/5",
                    )}
                  >
                    <td className="px-5 py-3.5">{item.project}</td>
                    <td className={cn("px-5 py-3.5 font-medium", item.completed && "line-through decoration-white/30")}>
                      {item.title}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums">{formatMinutes(Math.round(item.hours * 60))}</td>
                    <td className="px-5 py-3.5 tabular-nums">{item.urgency}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        <span
                          className={cn(
                            "inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                            item.completed
                              ? "bg-[rgba(16,185,129,0.16)] text-emerald-200"
                              : "bg-[rgba(var(--line),0.18)] text-[rgb(var(--muted))]",
                          )}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {item.completed ? "Done" : "Open"}
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
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(var(--line),0.45)] px-3 py-2 text-xs font-medium"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {item.completed ? "Reopen" : "Done"}
                        </button>
                        <button
                          type="button"
                          onClick={() => beginEdit(item)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(var(--line),0.45)] px-3 py-2 text-xs font-medium"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTodoItem(item.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(var(--line),0.45)] px-3 py-2 text-xs font-medium text-red-200"
                        >
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
      </section>

      {draft && editingId && (
        <section className="panel rounded-[28px] p-6 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[rgb(var(--muted))]">Editing</p>
              <h2 className="mt-2 text-xl font-semibold">{draft.title}</h2>
            </div>
            <button type="button" onClick={() => { setEditingId(null); setDraft(null); }} className="text-sm text-[rgb(var(--muted))]">
              Cancel
            </button>
          </div>
          <form onSubmit={saveEdit} className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_1.1fr_0.7fr_0.7fr_auto]">
            <input
              value={draft.project}
              onChange={(event) => setDraft({ ...draft, project: event.currentTarget.value })}
              className="rounded-xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-sm"
            />
            <input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.currentTarget.value })}
              className="rounded-xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-sm"
            />
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={draft.hours}
              onChange={(event) => setDraft({ ...draft, hours: Number(event.currentTarget.value) })}
              className="rounded-xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-sm"
            />
            <select
              value={draft.urgency}
              onChange={(event) => setDraft({ ...draft, urgency: Number(event.currentTarget.value) as TodoItem["urgency"] })}
              className="rounded-xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-sm"
            >
              {urgencyOptions.map((option) => (
                <option key={option} value={option}>
                  Urgency {option}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-xl bg-[rgb(var(--accent-strong))] px-4 py-3 text-sm font-medium text-white">
              Save
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
