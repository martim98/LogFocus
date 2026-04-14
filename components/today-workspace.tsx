"use client";

import { FormEvent, useMemo, useState } from "react";
import { TimerCard } from "@/components/widgets/timer-card";
import { useAppStore } from "@/lib/store";
import { TaskPanel } from "@/components/widgets/task-panel";
import { StatsStrip } from "@/components/widgets/stats-strip";
import { FolderKanban, Plus, Clock } from "lucide-react";
import { formatMinutes } from "@/lib/utils";
import { getProjectStats, estimateFinishTime } from "@/lib/analytics";
import { sortTasksByUrgencyAndDuration, getDateKey } from "@/lib/utils";

export function TodayWorkspace() {
  const projects = useAppStore((state) => state.projects);
  const tasks = useAppStore((state) => state.tasks);
  const plansByDate = useAppStore((state) => state.plansByDate);
  const sessions = useAppStore((state) => state.sessions);
  const settings = useAppStore((state) => state.settings);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const addProject = useAppStore((state) => state.addProject);
  const addTask = useAppStore((state) => state.addTask);
  const setActiveProject = useAppStore((state) => state.setActiveProject);
  const setActiveTask = useAppStore((state) => state.setActiveTask);

  const [projectTitle, setProjectTitle] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskEstimate, setTaskEstimate] = useState("1");

  const todayKey = getDateKey();
  const todayPlan = useMemo(() => plansByDate[todayKey] ?? [], [plansByDate, todayKey]);

  const orderedProjects = useMemo(() => projects.slice().sort((a, b) => a.order - b.order), [projects]);
  const activeProject = useMemo(
    () => orderedProjects.find((project) => project.id === activeProjectId) ?? orderedProjects[0] ?? null,
    [activeProjectId, orderedProjects],
  );
  
  const projectTasks = useMemo(() => {
    const filtered = tasks.filter((task) => task.projectId === activeProject?.id);
    return sortTasksByUrgencyAndDuration(filtered, todayPlan);
  }, [activeProject?.id, tasks, todayPlan]);
  const projectStats = useMemo(
    () => (activeProject ? getProjectStats(activeProject.id, sessions, tasks) : null),
    [activeProject, sessions, tasks],
  );

  const totalEstimate = useMemo(() => {
    return projectTasks.reduce((sum, task) => sum + task.estimatePomodoros, 0);
  }, [projectTasks]);

  const totalCompleted = useMemo(() => {
    return projectTasks.reduce((sum, task) => sum + task.completedPomodoros, 0);
  }, [projectTasks]);

  const remaining = Math.max(0, totalEstimate - totalCompleted);

  function onAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskTitle.trim();
    if (!title || !activeProject) return;
    const nextTaskId = addTask(activeProject.id, title, Math.max(1, Number(taskEstimate) || 1));
    setTaskTitle("");
    setTaskEstimate("1");
    setActiveTask(nextTaskId);
  }

  function onAddProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = projectTitle.trim();
    if (!title) return;
    const nextProjectId = addProject(title);
    setProjectTitle("");
    setActiveProject(nextProjectId);
  }

  return (
    <main className="flex flex-col gap-6">
      <StatsStrip />
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        {/* Left: Timer */}
        <div className="flex flex-col gap-4">
          <TimerCard />
        </div>

        {/* Right: Task list */}
        <div className="panel rounded-[22px] bg-[rgba(var(--panel),0.8)] p-5">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Active project</p>
              <h2 className="mt-1 text-xl font-semibold text-white">
                {activeProject ? activeProject.title : "No project"}
              </h2>
            </div>
            {projectStats && (
              <div className="rounded-xl bg-white px-3 py-2 text-center text-[rgb(var(--bg))]">
                <p className="text-[10px] uppercase tracking-wide opacity-60">Tracked</p>
                <p className="mt-0.5 text-base font-semibold">{formatMinutes(projectStats.focusMinutes)}</p>
              </div>
            )}
          </div>

          {activeProject ? (
            <>
              {/* Quick-add task */}
              <div className="mb-6 rounded-xl bg-white/5 p-4 border border-white/5">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[rgb(var(--muted))]">Quick Entry</p>
                <form onSubmit={onAddTask} className="flex gap-2">
                  <input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.currentTarget.value)}
                    placeholder="What needs to be done?"
                    className="min-w-0 flex-1 rounded-lg border border-[rgba(var(--line),0.5)] bg-[rgba(var(--bg),0.3)] px-3 py-2.5 text-sm text-white placeholder:text-[rgba(255,255,255,0.35)]"
                  />
                  <input
                    value={taskEstimate}
                    onChange={(e) => setTaskEstimate(e.currentTarget.value)}
                    type="number"
                    min={1}
                    title="Estimated pomodoros"
                    className="w-14 rounded-lg border border-[rgba(var(--line),0.5)] bg-[rgba(var(--bg),0.3)] px-2 py-2.5 text-center text-sm text-white"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-[rgb(var(--bg))] transition hover:bg-white/90"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add</span>
                  </button>
                </form>
              </div>

              <div className="mt-2 border-t border-[rgba(var(--line),0.3)] pt-6">
                <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[rgb(var(--muted))]">Active Task List</p>
                <TaskPanel projectId={activeProject.id} tasks={projectTasks} />
              </div>

              {/* Project Summary Footer */}
              {projectTasks.length > 0 && (
                <div className="mt-6 flex items-center justify-between border-t border-[rgba(var(--line),0.3)] pt-4 text-sm">
                  <div className="flex gap-4">
                    <div className="text-[rgb(var(--muted))]">
                      Est: <span className="font-semibold text-white">{totalEstimate}</span>
                    </div>
                    <div className="text-[rgb(var(--muted))]">
                      Act: <span className="font-semibold text-white">{totalCompleted}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium text-[rgb(var(--muted))]">
                    <Clock className="h-4 w-4 opacity-40" />
                    Finish:{" "}
                    <span className="font-semibold text-white">
                      {estimateFinishTime(remaining, settings.focusMinutes, settings.shortBreakMinutes)}
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-[rgb(var(--muted))]">Select a project below to manage tasks.</p>
          )}
        </div>
      </div>

      {/* Project Management: Now at the bottom */}
      <section className="grid gap-4 md:grid-cols-2">
        <form onSubmit={onAddProject} className="rounded-[18px] bg-[rgba(var(--line),0.2)] p-4">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Create new project</p>
          <div className="flex gap-2">
            <input
              value={projectTitle}
              onChange={(event) => setProjectTitle(event.currentTarget.value)}
              placeholder="New project name"
              className="min-w-0 flex-1 rounded-lg border border-[rgba(var(--line),0.4)] bg-[rgba(var(--bg),0.3)] px-3 py-2.5 text-sm text-white placeholder:text-[rgba(255,255,255,0.35)]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-[rgb(var(--bg))]"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </form>

        {orderedProjects.length > 0 ? (
          <div className="rounded-[18px] bg-[rgba(var(--line),0.2)] p-4">
            <p className="mb-2 px-1 text-xs font-medium uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Switch project</p>
            <div className="flex flex-wrap gap-2">
              {orderedProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => { setActiveProject(project.id); setActiveTask(null); }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    activeProject?.id === project.id
                      ? "bg-white text-[rgb(var(--bg))]"
                      : "bg-[rgba(var(--line),0.35)] text-white hover:bg-[rgba(var(--line),0.5)]"
                  }`}
                >
                  {project.title}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[18px] bg-[rgba(var(--line),0.2)] px-4 py-5 text-center text-sm text-[rgb(var(--muted))] flex items-center justify-center gap-2">
            <FolderKanban className="h-5 w-5 opacity-50" />
            Create your first project to start tracking.
          </div>
        )}
      </section>
    </main>
  );
}
