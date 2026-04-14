"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FolderKanban, Plus } from "lucide-react";
import { getProjectStats } from "@/lib/analytics";
import { useAppStore } from "@/lib/store";
import { cn, formatMinutes, sortTasksByUrgencyAndDuration, getDateKey } from "@/lib/utils";
import { TaskPanel } from "@/components/widgets/task-panel";

export function ProjectsView() {
  const projects = useAppStore((state) => state.projects);
  const tasks = useAppStore((state) => state.tasks);
  const plansByDate = useAppStore((state) => state.plansByDate);
  const sessions = useAppStore((state) => state.sessions);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const addProject = useAppStore((state) => state.addProject);
  const addTask = useAppStore((state) => state.addTask);
  const updateProject = useAppStore((state) => state.updateProject);
  const setActiveProject = useAppStore((state) => state.setActiveProject);

  const [projectTitle, setProjectTitle] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskEstimate, setTaskEstimate] = useState("1");

  const todayKey = getDateKey();
  const todayPlan = useMemo(() => plansByDate[todayKey] ?? [], [plansByDate, todayKey]);

  const orderedProjects = useMemo(() => projects.slice().sort((a, b) => a.order - b.order), [projects]);
  const activeProject = orderedProjects.find((project) => project.id === activeProjectId) ?? orderedProjects[0] ?? null;
  
  const projectTasks = useMemo(() => {
    const filtered = tasks.filter((task) => task.projectId === activeProject?.id);
    return sortTasksByUrgencyAndDuration(filtered, todayPlan);
  }, [activeProject?.id, tasks, todayPlan]);
  const projectStats = useMemo(
    () => (activeProject ? getProjectStats(activeProject.id, sessions, tasks) : null),
    [activeProject, sessions, tasks],
  );

  useEffect(() => {
    if (activeProject) {
      setDraftTitle(activeProject.title);
    }
  }, [activeProject?.id]);

  function onAddProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectTitle.trim()) return;
    addProject(projectTitle.trim());
    setProjectTitle("");
  }

  function onSaveProjectTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeProject || !draftTitle.trim()) return;
    updateProject(activeProject.id, { title: draftTitle.trim() });
  }

  function onAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeProject || !taskTitle.trim()) return;
    addTask(activeProject.id, taskTitle.trim(), Math.max(1, Number(taskEstimate) || 1));
    setTaskTitle("");
    setTaskEstimate("1");
  }

  return (
    <main className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      {/* Left: project list */}
      <section className="panel rounded-[30px] p-6 sm:p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Projects</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Organize work by project.</h1>

        <form onSubmit={onAddProject} className="mt-5 flex gap-2">
          <input
            value={projectTitle}
            onChange={(event) => setProjectTitle(event.currentTarget.value)}
            placeholder="New project name"
            className="min-w-0 flex-1 rounded-xl border border-[rgb(var(--line))] bg-transparent px-4 py-2.5 text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[rgb(var(--accent-strong))] px-4 py-2.5 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>

        <div className="mt-5 grid gap-2">
          {orderedProjects.map((project) => {
            const stats = getProjectStats(project.id, sessions, tasks);
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => setActiveProject(project.id)}
                className={cn(
                  "rounded-2xl border px-4 py-3.5 text-left transition",
                  activeProject?.id === project.id
                    ? "border-[rgb(var(--accent-strong))] bg-[rgba(var(--accent),0.12)]"
                    : "border-[rgb(var(--line))] bg-[rgba(var(--panel),0.76)] hover:bg-[rgba(var(--panel),0.9)]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{project.title}</p>
                    <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
                      {tasks.filter((t) => t.projectId === project.id).length} tasks · {stats.focusLabel}
                    </p>
                  </div>
                  <FolderKanban className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--muted))]" />
                </div>
              </button>
            );
          })}
          {orderedProjects.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[rgb(var(--line))] px-4 py-5 text-sm text-[rgb(var(--muted))]">
              No projects yet. Add your first above.
            </div>
          )}
        </div>
      </section>

      {/* Right: active project detail */}
      <div className="grid gap-5">
        {activeProject ? (
          <>
            <section className="panel rounded-[30px] p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Active project</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">{activeProject.title}</h2>
                  <p className="mt-1 text-sm text-[rgb(var(--muted))]">
                    {projectStats
                      ? `${projectStats.tasksDone}/${projectStats.totalTasks} tasks done · ${projectStats.loggedSessions} logged`
                      : "No data yet."}
                  </p>
                </div>
                <div className="rounded-2xl border border-[rgb(var(--line))] bg-[rgba(var(--accent),0.08)] px-4 py-3 text-center">
                  <p className="text-xs text-[rgb(var(--muted))]">Tracked</p>
                  <p className="mt-1 text-xl font-semibold">{projectStats ? projectStats.focusLabel : formatMinutes(0)}</p>
                </div>
              </div>

              <form onSubmit={onSaveProjectTitle} className="mt-5 flex gap-2">
                <input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.currentTarget.value)}
                  placeholder="Rename project"
                  className="min-w-0 flex-1 rounded-xl border border-[rgb(var(--line))] bg-transparent px-4 py-2.5 text-sm"
                />
                <button type="submit" className="rounded-xl border border-[rgb(var(--line))] px-4 py-2.5 text-sm font-medium">
                  Rename
                </button>
              </form>
            </section>

            {/* Task management */}
            <section className="panel rounded-[30px] p-6 sm:p-8">
              <h3 className="text-base font-semibold">Tasks</h3>
              
              <div className="mt-4 rounded-2xl bg-white/5 p-4 border border-white/5">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[rgb(var(--muted))]">Quick Entry</p>
                <form onSubmit={onAddTask} className="flex gap-2">
                  <input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.currentTarget.value)}
                    placeholder="New task..."
                    className="min-w-0 flex-1 rounded-xl border border-[rgb(var(--line))] bg-transparent px-4 py-2.5 text-sm"
                  />
                  <input
                    value={taskEstimate}
                    onChange={(e) => setTaskEstimate(e.currentTarget.value)}
                    type="number"
                    min={1}
                    title="Estimated pomodoros"
                    className="w-14 rounded-xl border border-[rgb(var(--line))] bg-transparent px-2 py-2.5 text-center text-sm"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-[rgb(var(--accent-strong))] px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 shadow-lg"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add</span>
                  </button>
                </form>
              </div>

              <div className="mt-8 pt-2 border-t border-[rgba(var(--line),0.3)]">
                <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[rgb(var(--muted))]">All Tasks</p>
                <TaskPanel projectId={activeProject.id} tasks={projectTasks} />
              </div>
            </section>
          </>
        ) : (
          <section className="panel rounded-[30px] p-6 sm:p-8">
            <div className="rounded-2xl border border-dashed border-[rgb(var(--line))] px-4 py-6 text-sm text-[rgb(var(--muted))]">
              Select a project on the left to view and manage its tasks.
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
