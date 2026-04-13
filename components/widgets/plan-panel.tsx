"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { PlanItem, Task } from "@/lib/domain";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const priorities: PlanItem["priority"][] = ["must", "should", "bonus"];

export function PlanPanel({ planItems, tasks }: { planItems: PlanItem[]; tasks: Task[] }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<PlanItem["priority"]>("must");
  const [linkedTaskId, setLinkedTaskId] = useState<string>("");
  const projects = useAppStore((state) => state.projects);
  const addPlanItem = useAppStore((state) => state.addPlanItem);
  const updatePlanItem = useAppStore((state) => state.updatePlanItem);
  const deletePlanItem = useAppStore((state) => state.deletePlanItem);
  const projectLabelById = new Map(projects.map((project) => [project.id, project.title]));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }
    addPlanItem(title.trim(), priority, linkedTaskId || null);
    setTitle("");
    setPriority("must");
    setLinkedTaskId("");
  }

  const orderedPlan = planItems.slice().sort((a, b) => a.order - b.order);

  return (
    <section className="panel rounded-[30px] p-6">
      <h2 className="text-xl font-semibold">Today&apos;s plan</h2>
      <p className="mt-2 text-sm text-[rgb(var(--muted))]">Keep the day small enough to finish, then let the timer prove the work happened.</p>
      <form onSubmit={onSubmit} className="mt-5 grid gap-3">
        <input
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
          placeholder="Plan item title"
          className="rounded-2xl border border-[rgb(var(--line))] bg-transparent px-4 py-3"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={priority} onChange={(event) => setPriority(event.currentTarget.value as PlanItem["priority"])} className="rounded-2xl border border-[rgb(var(--line))] bg-transparent px-4 py-3">
            {priorities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select value={linkedTaskId} onChange={(event) => setLinkedTaskId(event.currentTarget.value)} className="rounded-2xl border border-[rgb(var(--line))] bg-transparent px-4 py-3">
            <option value="">No linked task</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {projectLabelById.get(task.projectId ?? "") ? `${projectLabelById.get(task.projectId ?? "")} / ${task.title}` : task.title}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[rgb(var(--accent-strong))] px-4 py-3 text-sm font-medium text-white">
          <Plus className="h-4 w-4" />
          Add plan item
        </button>
      </form>
      <div className="mt-5 grid gap-3">
        {orderedPlan.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[rgb(var(--line))] px-4 py-6 text-sm text-[rgb(var(--muted))]">
            No plan yet. Add the minimum set of outcomes that would make today count.
          </div>
        ) : (
          orderedPlan.map((item) => (
            <article key={item.id} className="rounded-[24px] border border-[rgb(var(--line))] bg-[rgba(var(--panel),0.76)] px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-[rgb(var(--muted))]">
                    <span className={cn("rounded-full px-2 py-1 text-xs uppercase tracking-[0.18em]", priorityClass(item.priority))}>{item.priority}</span>
                    {item.linkedTaskId ? (
                      <span className="ml-2">
                        Linked to{" "}
                        {(() => {
                          const task = tasks.find((entry) => entry.id === item.linkedTaskId);
                          if (!task) {
                            return "task";
                          }
                          const projectLabel = projectLabelById.get(task.projectId ?? "");
                          return projectLabel ? `${projectLabel} / ${task.title}` : task.title;
                        })()}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => updatePlanItem(item.id, { status: item.status === "done" ? "planned" : "done" })} className="rounded-full p-2 text-[rgb(var(--muted))] hover:bg-[rgba(var(--accent),0.12)]">
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => deletePlanItem(item.id)} className="rounded-full p-2 text-[rgb(var(--muted))] hover:bg-[rgba(var(--accent-alt),0.12)]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function priorityClass(priority: PlanItem["priority"]) {
  if (priority === "must") {
    return "bg-[rgba(var(--accent-alt),0.16)] text-[rgb(var(--text))]";
  }
  if (priority === "should") {
    return "bg-[rgba(var(--accent),0.18)] text-[rgb(var(--text))]";
  }
  return "bg-[rgba(91,135,166,0.16)] text-[rgb(var(--text))]";
}
