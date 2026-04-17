"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Plus, Trash2, Zap } from "lucide-react";
import { useTasks } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/domain";

type DraftTask = {
  project: string;
  title: string;
  urgency: string;
  hours: string;
};

const WORK_DAY_START = 9;
const WORK_DAY_END = 18;

function formatHours(hours: number) {
  return `${Number.isInteger(hours) ? hours : Number(hours.toFixed(1))}h`;
}

function riskLabel(task: Task, projectedFinishHour: number) {
  if (task.status === "done") return { label: "Done", kind: "success" as const };
  if (task.urgency <= 0 && projectedFinishHour > WORK_DAY_END) return { label: "At risk", kind: "danger" as const };
  if (task.urgency <= 1 && projectedFinishHour > WORK_DAY_END) return { label: "Watch", kind: "warning" as const };
  return { label: "On track", kind: "neutral" as const };
}

function badgeClass(kind: "neutral" | "warning" | "danger" | "success") {
  switch (kind) {
    case "warning":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
    case "danger":
      return "border-red-500/20 bg-red-500/10 text-red-200";
    case "success":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    default:
      return "border-[rgba(var(--line),0.3)] bg-[rgba(var(--bg),0.2)] text-[rgb(var(--muted))]";
  }
}

function EntryBadge({
  label,
  kind = "neutral",
}: {
  label: string;
  kind?: "neutral" | "warning" | "danger" | "success";
}) {
  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", badgeClass(kind))}>
      {label}
    </span>
  );
}

function StatPill({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "danger" | "success" }) {
  return (
    <div className="rounded-2xl border border-[rgba(var(--line),0.3)] bg-[rgba(var(--bg),0.2)] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[rgb(var(--muted))]">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold", tone === "danger" && "text-red-200", tone === "success" && "text-emerald-200")}>{value}</p>
    </div>
  );
}

export function CaptureView() {
  const { tasks, error, addTask, updateTask, deleteTask } = useTasks();

  const [now, setNow] = useState(new Date());
  const [form, setForm] = useState<DraftTask>({
    project: "",
    title: "",
    urgency: "0",
    hours: "1",
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const orderedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.status !== b.status) return a.status === "todo" ? -1 : 1;
      if (a.urgency !== b.urgency) return a.urgency - b.urgency;
      if (a.hours !== b.hours) return b.hours - a.hours;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [tasks]);

  const activeTasks = orderedTasks.filter((task) => task.status !== "done");
  const completedTasks = orderedTasks.filter((task) => task.status === "done");
  const atRiskCount = activeTasks.filter((task, index) => {
    let cursor = now.getHours() + now.getMinutes() / 60;
    if (cursor < WORK_DAY_START) cursor = WORK_DAY_START;
    for (const item of activeTasks.slice(0, index)) {
      cursor += item.hours;
    }
    return cursor + task.hours > WORK_DAY_END && task.urgency <= 1;
  }).length;
  const totalHours = tasks.reduce((sum, task) => sum + task.hours, 0);

  async function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) return;

    const savedId = await addTask({
      project: form.project.trim(),
      title,
      urgency: Number.isFinite(Number(form.urgency)) ? Math.max(0, Number(form.urgency)) : 0,
      hours: Number.isFinite(Number(form.hours)) ? Math.max(0.5, Number(form.hours)) : 1,
    });
    if (savedId) {
      setForm({ project: "", title: "", urgency: "0", hours: "1" });
    }
  }

  return (
    <main className="flex flex-col gap-6">
      <section className="panel rounded-[30px] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Planner</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Tasks editor.</h1>
            <p className="mt-3 text-sm leading-6 text-[rgb(var(--muted))]">
              Add and edit tasks here. This surface writes directly to the <code>tasks</code> table and stays separate from session logging.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[520px]">
            <StatPill label="Active" value={String(activeTasks.length)} />
            <StatPill label="Risk" value={String(atRiskCount)} tone={atRiskCount > 0 ? "danger" : "neutral"} />
            <StatPill label="Done" value={String(completedTasks.length)} tone={completedTasks.length > 0 ? "success" : "neutral"} />
            <StatPill label="Hours" value={formatHours(totalHours)} />
          </div>
        </div>
      </section>

      {error && (
        <section className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          Save failed: {error}
        </section>
      )}

      <section className="panel rounded-[24px] p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Add task</h2>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">Create a task row with project, title, urgency, and hours.</p>
          </div>
          <div className="rounded-full border border-[rgba(var(--line),0.3)] bg-[rgba(var(--bg),0.2)] px-3 py-1 text-xs text-[rgb(var(--muted))]">
            Work window 09:00 - 18:00
          </div>
        </div>

        <form onSubmit={handleAddTask} className="grid gap-3 xl:grid-cols-[1fr_1.2fr_0.75fr_0.75fr_auto]">
          <InputField label="Project">
            <input
              value={form.project}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({ ...current, project: value }));
              }}
              placeholder="Project name"
              className="w-full rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.28)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[rgba(255,255,255,0.35)] focus:border-[rgb(var(--accent))] focus:bg-[rgba(var(--bg),0.38)]"
            />
          </InputField>
          <InputField label="Task">
            <input
              value={form.title}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({ ...current, title: value }));
              }}
              placeholder="What needs to happen?"
              className="w-full rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.28)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[rgba(255,255,255,0.35)] focus:border-[rgb(var(--accent))] focus:bg-[rgba(var(--bg),0.38)]"
            />
          </InputField>
          <InputField label="Urgency">
            <div className="flex items-center gap-2 rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.28)] px-4 py-3">
              <Zap className="h-4 w-4 text-amber-400" />
              <input
                value={form.urgency}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setForm((current) => ({ ...current, urgency: value }));
                }}
                type="number"
                min={0}
                step={0.1}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[rgba(255,255,255,0.35)]"
              />
            </div>
          </InputField>
          <InputField label="Hours">
            <div className="flex items-center gap-2 rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.28)] px-4 py-3">
              <Clock className="h-4 w-4 text-[rgb(var(--muted))]" />
              <input
                value={form.hours}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setForm((current) => ({ ...current, hours: value }));
                }}
                type="number"
                min={0.5}
                step={0.5}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[rgba(255,255,255,0.35)]"
              />
            </div>
          </InputField>
          <button type="submit" className="mt-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[rgb(var(--bg))] transition hover:bg-white/90">
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>
      </section>

      <section className="panel rounded-[24px] p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Tasks</h2>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">Edit the task rows directly below. Changes save to the local workspace store.</p>
          </div>
          <div className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">
            {orderedTasks.length} total · {activeTasks.length} open
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {orderedTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[rgba(var(--line),0.5)] px-4 py-8 text-sm text-[rgb(var(--muted))]">
              No tasks yet. Add your first task above.
            </div>
          ) : (
            orderedTasks.map((task) => {
              let cursor = now.getHours() + now.getMinutes() / 60;
              if (cursor < WORK_DAY_START) cursor = WORK_DAY_START;
              const preceding = activeTasks.filter((item) => item.order < task.order && item.status !== "done");
              cursor += preceding.reduce((sum, item) => sum + item.hours, 0);
              const projectedFinishHour = cursor + task.hours;
              const risk = riskLabel(task, projectedFinishHour);

              return (
                <article
                  key={task.id}
                  className={cn(
                    "rounded-[28px] border p-4 transition sm:p-5",
                    task.status === "done"
                      ? "border-[rgba(var(--line),0.18)] bg-[rgba(var(--bg),0.18)] opacity-70"
                      : "border-[rgba(var(--line),0.32)] bg-[rgba(var(--bg),0.22)] hover:border-[rgba(var(--line),0.6)]",
                  )}
                >
                  <div className="grid gap-4 xl:grid-cols-[0.9fr_1.4fr_0.65fr_0.65fr_auto] xl:items-center">
                    <TaskEditor label="Project">
                      <input
                        value={task.project}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          void updateTask(task.id, { project: value });
                        }}
                        className="w-full rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.28)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[rgba(255,255,255,0.35)] focus:border-[rgb(var(--accent))] focus:bg-[rgba(var(--bg),0.38)]"
                        placeholder="Project"
                      />
                    </TaskEditor>
                    <TaskEditor label="Task">
                      <input
                        value={task.title}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          void updateTask(task.id, { title: value });
                        }}
                        className="w-full rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.28)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[rgba(255,255,255,0.35)] focus:border-[rgb(var(--accent))] focus:bg-[rgba(var(--bg),0.38)]"
                        placeholder="Task title"
                      />
                    </TaskEditor>
                    <TaskEditor label="Urgency">
                      <input
                        value={String(task.urgency)}
                        onChange={(event) => {
                          const value = Number(event.currentTarget.value);
                          void updateTask(task.id, { urgency: Math.max(0, Number.isFinite(value) ? value : 0) });
                        }}
                        type="number"
                        min={0}
                        step={0.1}
                        className="w-full rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.28)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[rgba(255,255,255,0.35)] focus:border-[rgb(var(--accent))] focus:bg-[rgba(var(--bg),0.38)]"
                      />
                    </TaskEditor>
                    <TaskEditor label="Hours">
                      <input
                        value={String(task.hours)}
                        onChange={(event) => {
                          const value = Number(event.currentTarget.value);
                          void updateTask(task.id, { hours: Math.max(0.5, Number.isFinite(value) ? value : 0.5) });
                        }}
                        type="number"
                        min={0.5}
                        step={0.5}
                        className="w-full rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.28)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[rgba(255,255,255,0.35)] focus:border-[rgb(var(--accent))] focus:bg-[rgba(var(--bg),0.38)]"
                      />
                    </TaskEditor>
                    <div className="flex items-center gap-2 xl:justify-end">
                      <button
                        type="button"
                        onClick={() => void updateTask(task.id, { status: task.status === "done" ? "todo" : "done" })}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(var(--line),0.35)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[rgba(var(--line),0.16)]"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {task.status === "done" ? "Undo" : "Done"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteTask(task.id)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(var(--line),0.35)] px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--muted))] transition hover:bg-[rgba(var(--line),0.16)] hover:text-white"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <EntryBadge label={risk.label} kind={risk.kind} />
                    <EntryBadge label={task.status === "done" ? "Completed" : "Open"} kind={task.status === "done" ? "success" : "neutral"} />
                    <EntryBadge label={task.project || "No project"} />
                    <EntryBadge label={`${formatHours(task.hours)} · ${task.urgency} urgency`} />
                    <EntryBadge label={`Finish ${projectedFinishHour.toFixed(1)}h`} kind={risk.kind === "danger" ? "danger" : risk.kind === "warning" ? "warning" : "neutral"} />
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}

function InputField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(var(--muted))]">{label}</span>
      {children}
    </label>
  );
}

function TaskEditor({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(var(--muted))] lg:hidden">{label}</span>
      {children}
    </label>
  );
}
