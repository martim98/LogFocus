"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FolderKanban, Plus } from "lucide-react";
import { getProjectStats } from "@/lib/analytics";
import { useAppStore } from "@/lib/store";
import { cn, formatMinutes } from "@/lib/utils";
import { useProjects, useTasks, useSessions } from "@/lib/hooks";

export function ProjectsView() {
  const { projects, error, addProject, updateProject } = useProjects();
  const { tasks } = useTasks();
  const { sessions } = useSessions();
  
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const setActiveProject = useAppStore((state) => state.setActiveProject);

  const [projectTitle, setProjectTitle] = useState("");
  const [draftTitle, setDraftTitle] = useState("");

  const orderedProjects = useMemo(() => projects.slice().sort((a, b) => a.order - b.order), [projects]);
  const activeProject = orderedProjects.find((project) => project.id === activeProjectId) ?? orderedProjects[0] ?? null;

  useEffect(() => {
    if (activeProject) setDraftTitle(activeProject.title);
  }, [activeProject?.id]);

  async function onAddProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectTitle.trim()) return;
    const savedId = await addProject(projectTitle.trim());
    if (savedId) setProjectTitle("");
  }

  async function onSaveProjectTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeProject || !draftTitle.trim()) return;
    await updateProject(activeProject.id, { title: draftTitle.trim() });
  }

  return (
    <main className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
      <section className="panel rounded-[28px] p-6 sm:p-7">
        <p className="text-sm uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Projects</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Organize work by project.</h1>
        <p className="mt-2 max-w-xl text-sm text-[rgb(var(--muted))]">
          Keep the project list clean, then use the detail panel for the currently active item.
        </p>

        <form onSubmit={onAddProject} className="mt-5 flex gap-2">
          <input
            value={projectTitle}
            onChange={(event) => setProjectTitle(event.currentTarget.value)}
            placeholder="New project name"
            className="min-w-0 flex-1 rounded-xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-2.5 text-sm"
          />
          <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl bg-[rgb(var(--accent-strong))] px-4 py-2.5 text-sm font-medium text-white">
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            Save failed: {error}
          </div>
        )}

        <div className="mt-5 grid gap-2">
          {orderedProjects.map((project) => {
            const stats = getProjectStats(project.id, project.title, sessions, tasks);
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => setActiveProject(project.id)}
                className={cn(
                  "rounded-2xl border px-4 py-3.5 text-left transition",
                  activeProject?.id === project.id
                    ? "border-[rgba(var(--accent-strong),0.7)] bg-[rgba(var(--accent),0.12)] shadow-sm"
                    : "border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.24)] hover:bg-[rgba(var(--bg),0.34)]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{project.title}</p>
                    <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
                      {stats.loggedSessions} logged · {stats.focusLabel}
                    </p>
                  </div>
                  <FolderKanban className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--muted))]" />
                </div>
              </button>
            );
          })}
          {orderedProjects.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[rgba(var(--line),0.5)] px-4 py-5 text-sm text-[rgb(var(--muted))]">
              No projects yet. Add your first above.
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-5">
        {activeProject ? (
          <section className="panel rounded-[28px] p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Active project</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">{activeProject.title}</h2>
                <p className="mt-1 text-sm text-[rgb(var(--muted))]">
                  {formatMinutes(Math.round((getProjectStats(activeProject.id, activeProject.title, sessions, tasks)?.focusMinutes ?? 0)))}
                </p>
              </div>
              <div className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Tracked</p>
                <p className="mt-1 text-xl font-semibold">{getProjectStats(activeProject.id, activeProject.title, sessions, tasks)?.focusLabel ?? formatMinutes(0)}</p>
              </div>
            </div>

            <form onSubmit={onSaveProjectTitle} className="mt-5 flex gap-2">
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.currentTarget.value)}
                placeholder="Rename project"
                className="min-w-0 flex-1 rounded-xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-2.5 text-sm"
              />
              <button type="submit" className="rounded-xl border border-[rgba(var(--line),0.45)] px-4 py-2.5 text-sm font-medium">
                Rename
              </button>
            </form>
          </section>
        ) : (
          <section className="panel rounded-[28px] p-6 sm:p-7">
            <div className="rounded-2xl border border-dashed border-[rgba(var(--line),0.5)] px-4 py-6 text-sm text-[rgb(var(--muted))]">
              Select a project on the left.
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
