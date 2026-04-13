"use client";

import { ArrowDown, ArrowUp, CheckCircle2, Circle, Trash2 } from "lucide-react";
import { Task } from "@/lib/domain";
import { cn, formatMinutes } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { getTaskTimeLogged } from "@/lib/analytics";

export function TaskPanel({ tasks }: { projectId: string; tasks: Task[] }) {
  const sessions = useAppStore((state) => state.sessions);
  const updateTask = useAppStore((state) => state.updateTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const setActiveTask = useAppStore((state) => state.setActiveTask);
  const reorderTask = useAppStore((state) => state.reorderTask);
  const activeTaskId = useAppStore((state) => state.activeTaskId);

  const orderedTasks = tasks.slice().sort((a, b) => a.order - b.order);
  const todoTasks = orderedTasks.filter((t) => t.status === "todo");
  const doneTasks = orderedTasks.filter((t) => t.status === "done");

  return (
    <div className="rounded-[14px]">
      <div className="grid gap-2">
        {orderedTasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[rgba(var(--line),0.5)] px-4 py-5 text-center text-sm text-[rgb(var(--muted))]">
            No tasks yet — add one above.
          </div>
        ) : (
          <>
            {todoTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isActive={activeTaskId === task.id}
                timeLogged={getTaskTimeLogged(task.id, sessions)}
                onSelect={() => setActiveTask(activeTaskId === task.id ? null : task.id)}
                onToggle={() => updateTask(task.id, { status: task.status === "done" ? "todo" : "done" })}
                onMoveUp={() => reorderTask(task.id, "up")}
                onMoveDown={() => reorderTask(task.id, "down")}
                onDelete={() => deleteTask(task.id)}
              />
            ))}
            {doneTasks.length > 0 && (
              <>
                <p className="mt-1 px-1 text-xs font-medium uppercase tracking-[0.15em] text-[rgb(var(--muted))]">Done</p>
                {doneTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isActive={false}
                    timeLogged={getTaskTimeLogged(task.id, sessions)}
                    onSelect={() => {}}
                    onToggle={() => updateTask(task.id, { status: "todo" })}
                    onMoveUp={() => reorderTask(task.id, "up")}
                    onMoveDown={() => reorderTask(task.id, "down")}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  isActive,
  timeLogged,
  onSelect,
  onToggle,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  task: Task;
  isActive: boolean;
  timeLogged: number;
  onSelect: () => void;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className={cn(
        "group flex items-center gap-3 rounded-xl border px-3 py-3 transition",
        task.status === "done"
          ? "border-[rgba(var(--line),0.2)] bg-[rgba(var(--bg),0.2)] opacity-60"
          : isActive
            ? "border-l-[3px] border-l-[rgb(var(--accent))] border-t-[rgba(var(--line),0.5)] border-r-[rgba(var(--line),0.5)] border-b-[rgba(var(--line),0.5)] bg-[rgba(var(--bg),0.4)] shadow-sm"
            : "border-[rgba(var(--line),0.3)] bg-[rgba(var(--bg),0.2)] hover:border-[rgba(var(--line),0.6)]",
      )}
    >
      {/* Complete toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0 text-[rgb(var(--muted))] hover:text-white transition"
      >
        {task.status === "done" ? (
          <CheckCircle2 className="h-4 w-4 text-[rgb(var(--accent-alt))]" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </button>

      {/* Title + meta */}
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <p className={cn("text-sm font-medium text-white", task.status === "done" && "line-through text-[rgb(var(--muted))]")}>
          {task.title}
        </p>
        <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
          {task.completedPomodoros}/{task.estimatePomodoros} pomo
        </p>
      </button>

      {/* Time logged badge */}
      {timeLogged > 0 && (
        <span className="shrink-0 rounded-md bg-[rgba(var(--line),0.3)] px-2 py-1 text-xs font-medium text-[rgb(var(--muted))]">
          {formatMinutes(timeLogged)}
        </span>
      )}

      {/* Reorder + delete (hover only) */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
        <button
          type="button"
          onClick={onMoveUp}
          className="rounded p-1 text-[rgb(var(--muted))] hover:bg-[rgba(255,255,255,0.1)] hover:text-white"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          className="rounded p-1 text-[rgb(var(--muted))] hover:bg-[rgba(255,255,255,0.1)] hover:text-white"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-1 text-[rgb(var(--muted))] hover:bg-[rgba(255,255,255,0.1)] hover:text-white"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}
