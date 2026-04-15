"use client";

import { FormEvent, useMemo, useState } from "react";
import { TimerCard } from "@/components/widgets/timer-card";
import { useAppStore } from "@/lib/store";
import { StatsStrip } from "@/components/widgets/stats-strip";
import { FolderKanban, Plus } from "lucide-react";
import { formatMinutes } from "@/lib/utils";
import { getProjectStats, estimateFinishTime } from "@/lib/analytics";
import { useProjects, useTasks, useSessions, useSettings } from "@/lib/hooks";

export function TodayWorkspace() {
  const { projects, addProject } = useProjects();
  const { tasks } = useTasks();
  const { sessions } = useSessions();
  const { settings } = useSettings();

  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const activeTaskName = useAppStore((state) => state.activeTaskName);
  const setActiveProject = useAppStore((state) => state.setActiveProject);
  const setActiveTask = useAppStore((state) => state.setActiveTask);

  const [projectTitle, setProjectTitle] = useState("");

  const orderedProjects = useMemo(() => projects.slice().sort((a, b) => a.order - b.order), [projects]);
  const activeProject = useMemo(
    () => orderedProjects.find((project) => project.id === activeProjectId) ?? orderedProjects[0] ?? null,
    [activeProjectId, orderedProjects],
  );
  
  const projectStats = useMemo(
    () => (activeProject ? getProjectStats(activeProject.id, activeProject.title, sessions, tasks) : null),
    [activeProject, sessions, tasks],
  );

  async function onAddProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = projectTitle.trim();
    if (!title) return;
    const nextProjectId = await addProject(title);
    setProjectTitle("");
    if (nextProjectId) setActiveProject(nextProjectId);
  }

  return (
    <main className="flex flex-col gap-6 pb-12">
      <StatsStrip />
      
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div className="flex flex-col gap-6">
          <TimerCard />
          <div className="panel rounded-[28px] p-6 sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[rgb(var(--muted))]">Deep work context</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  {activeProject ? activeProject.title : "Ready to Start"}
                </h2>
              </div>
              {projectStats && (
                <div className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.28)] px-4 py-2.5 text-center text-white">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Tracked today</p>
                  <p className="mt-1 text-lg font-semibold">{formatMinutes(projectStats.focusMinutes)}</p>
                </div>
              )}
            </div>

            {activeProject ? (
              <div className="grid gap-4">
                <div className="grid gap-2 rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.28)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Active task</span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Updates session log</span>
                  </div>
                  <input
                    value={activeTaskName ?? ""}
                    onChange={(event) => setActiveTask(null, event.currentTarget.value || null)}
                    placeholder="Focusing on..."
                    className="w-full rounded-xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg-secondary),0.28)] px-4 py-3 text-lg font-medium text-white placeholder:text-white/20 outline-none transition-all focus:border-[rgb(var(--accent))]"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-4">
                    <span className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Estimated finish</span>
                    <span className="mt-1 block text-lg font-semibold text-white">
                      {estimateFinishTime(0, settings.focusMinutes, settings.shortBreakMinutes)}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-4 sm:text-right">
                    <span className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Daily goal</span>
                    <span className="mt-1 block text-lg font-semibold text-white">6.0h</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-[rgba(var(--line),0.5)] bg-[rgba(var(--bg),0.22)] p-6 text-center text-sm text-[rgb(var(--muted))]">
                Choose a project below to unlock tracking capabilities.
              </p>
            )}
          </div>
        </div>

        <section className="flex flex-col gap-6">
          <div className="panel rounded-[28px] p-6 sm:p-7">
            <p className="mb-4 px-1 text-xs font-semibold uppercase tracking-[0.22em] text-[rgb(var(--muted))]">Quick switch project</p>
            {orderedProjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {orderedProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setActiveProject(project.id)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all active:scale-95 ${
                      activeProject?.id === project.id
                        ? "bg-white text-[rgb(var(--bg))] shadow-sm ring-1 ring-white/20"
                        : "border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] text-white hover:bg-[rgba(var(--bg),0.35)]"
                    }`}
                  >
                    {project.title}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[rgba(var(--line),0.5)] px-4 py-8 text-center text-sm text-[rgb(var(--muted))]">
                <FolderKanban className="h-5 w-5 opacity-50" />
                Create your first project below.
              </div>
            )}
          </div>

          <form onSubmit={onAddProject} className="panel rounded-[28px] p-6 sm:p-7">
            <p className="mb-4 px-1 text-xs font-semibold uppercase tracking-[0.22em] text-[rgb(var(--muted))]">New project</p>
            <div className="flex gap-2">
              <input
                value={projectTitle}
                onChange={(event) => setProjectTitle(event.currentTarget.value)}
                placeholder="Workspace name..."
                className="min-w-0 flex-1 rounded-xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none transition-all focus:border-[rgb(var(--accent))]"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-[rgb(var(--accent))] px-5 py-3 text-sm font-semibold text-white transition-all active:scale-95"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                Add
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
