"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { TimerCard } from "@/components/widgets/timer-card";
import { FocusRewardsCard } from "@/components/widgets/focus-rewards-card";
import { useAppStore } from "@/lib/store";
import { StatsStrip } from "@/components/widgets/stats-strip";
import { FolderKanban, Link2, Plus, X } from "lucide-react";
import { formatMinutes } from "@/lib/utils";
import { getBillableAdjustedDailyTargetHours, getProjectStats, estimateFinishTime, getRecentTaskSuggestions, getRecentTodoSuggestions } from "@/lib/analytics";
import { useFocusRewards, useProjects, useTasks, useSessions, useSettings, useTodoItems } from "@/lib/hooks";
import { getOrderedProjects } from "@/lib/resource-helpers";

export function TodayWorkspace() {
  const { projects, addProject } = useProjects();
  const { tasks } = useTasks();
  const { todoItems } = useTodoItems();
  const { sessions, addSession } = useSessions();
  const { settings } = useSettings();
  const { focusRewards, updateFocusRewards } = useFocusRewards();

  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const activeTaskId = useAppStore((state) => state.activeTaskId);
  const activeTaskName = useAppStore((state) => state.activeTaskName);
  const activeTodoItemId = useAppStore((state) => state.activeTodoItemId);
  const activeTodoItemTitle = useAppStore((state) => state.activeTodoItemTitle);
  const setActiveProject = useAppStore((state) => state.setActiveProject);
  const setActiveTask = useAppStore((state) => state.setActiveTask);
  const setActiveTodoItem = useAppStore((state) => state.setActiveTodoItem);

  const [projectTitle, setProjectTitle] = useState("");
  const [taskDraft, setTaskDraft] = useState("");

  const orderedProjects = useMemo(() => getOrderedProjects(projects), [projects]);
  const projectIdByTitle = useMemo(
    () => new Map(orderedProjects.map((project) => [project.title.trim().toLowerCase(), project.id])),
    [orderedProjects],
  );
  const activeProject = useMemo(
    () => orderedProjects.find((project) => project.id === activeProjectId) ?? orderedProjects[0] ?? null,
    [activeProjectId, orderedProjects],
  );
  const recentTaskSuggestions = useMemo(
    () => (activeProject ? getRecentTaskSuggestions(activeProject.id, activeProject.title, sessions, tasks, 5) : []),
    [activeProject, sessions, tasks],
  );
  const recentTodoSuggestions = useMemo(() => {
    const suggestions = getRecentTodoSuggestions(todoItems, sessions, 12).map((suggestion) => ({
      ...suggestion,
      resolvedProjectId: suggestion.projectId ?? projectIdByTitle.get(suggestion.project.trim().toLowerCase()) ?? null,
    }));

    if (!activeProject) {
      return suggestions.slice(0, 5);
    }

    return suggestions
      .filter((suggestion) => suggestion.resolvedProjectId === activeProject.id)
      .slice(0, 5);
  }, [activeProject, projectIdByTitle, sessions, todoItems]);
  
  const projectStats = useMemo(
    () => (activeProject ? getProjectStats(activeProject.id, activeProject.title, sessions, tasks) : null),
    [activeProject, sessions, tasks],
  );
  const dailyTargetHours = useMemo(() => getBillableAdjustedDailyTargetHours(settings), [settings]);

  useEffect(() => {
    setTaskDraft(activeTaskName ?? "");
  }, [activeTaskName]);

  async function onAddProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = projectTitle.trim();
    if (!title) return;
    const nextProjectId = await addProject(title);
    setProjectTitle("");
    if (nextProjectId) setActiveProject(nextProjectId);
  }

  async function commitTask(nextTaskId: string | null, nextTaskName: string) {
    const trimmed = nextTaskName.trim();
    const resolvedName = trimmed.length > 0 ? trimmed : null;
    const currentTaskName = activeTaskName?.trim() ?? null;
    if (activeTaskId === nextTaskId && currentTaskName === resolvedName) {
      setTaskDraft(resolvedName ?? "");
      return;
    }

    const session = setActiveTask(nextTaskId, resolvedName, settings);
    setTaskDraft(resolvedName ?? "");
    if (session) {
      await addSession(session);
    }
  }

  async function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await commitTask(null, taskDraft);
  }

  async function handleAttachTodoLabel(todoItemId: string | null, title: string | null) {
    const session = setActiveTodoItem(todoItemId, title, settings);
    if (session) {
      await addSession(session);
    }
  }

  return (
    <main className="flex flex-col gap-6 pb-12">
      <StatsStrip sessions={sessions} projects={orderedProjects} settings={settings} />
      
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div className="flex flex-col gap-6">
          <TimerCard sessions={sessions} settings={settings} activeProject={activeProject} />
          <FocusRewardsCard
            sessions={sessions}
            focusRewards={focusRewards}
            settings={settings}
            activeProject={activeProject}
            updateFocusRewards={updateFocusRewards}
          />
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
                <form onSubmit={handleTaskSubmit} className="grid gap-4 rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.28)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Timer task</span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Updates session log</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={taskDraft}
                      onChange={(event) => setTaskDraft(event.currentTarget.value)}
                      placeholder="Focusing on..."
                      className="min-w-0 flex-1 rounded-xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg-secondary),0.28)] px-4 py-3 text-lg font-medium text-white placeholder:text-white/20 outline-none transition-all focus:border-[rgb(var(--accent))]"
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-[rgb(var(--accent))] px-4 py-3 text-sm font-semibold text-white transition-all active:scale-95"
                    >
                      Set
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentTaskSuggestions.length > 0 ? (
                      recentTaskSuggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.taskId ?? suggestion.title}-${suggestion.lastUsedAt}`}
                          type="button"
                          onClick={() => void commitTask(suggestion.taskId, suggestion.title)}
                          className="rounded-full border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.18)] px-3 py-1.5 text-xs font-medium text-[rgb(var(--muted))] transition hover:bg-[rgba(var(--bg),0.3)] hover:text-white"
                        >
                          {suggestion.title}
                        </button>
                      ))
                    ) : (
                      <span className="text-xs text-[rgb(var(--muted))]">No recent tasks for this project yet.</span>
                    )}
                  </div>
                  <div className="rounded-2xl border border-[rgba(var(--line),0.35)] bg-[rgba(var(--bg),0.18)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-[rgb(var(--muted))]">
                        <Link2 className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase tracking-[0.18em]">To-do label</span>
                      </div>
                      {activeTodoItemTitle ? (
                        <button
                          type="button"
                          onClick={() => void handleAttachTodoLabel(null, null)}
                          className="inline-flex items-center gap-1 rounded-full border border-[rgba(var(--line),0.35)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[rgb(var(--muted))] transition hover:bg-white/5 hover:text-white"
                        >
                          <X className="h-3 w-3" />
                          Clear
                        </button>
                      ) : null}
                    </div>
                    {activeTodoItemTitle ? (
                      <p className="mt-2 text-sm text-white">
                        Attached for to-do-side time tracking only: <span className="font-semibold">{activeTodoItemTitle}</span>
                      </p>
                    ) : null}
                    {recentTodoSuggestions.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {recentTodoSuggestions.map((suggestion) => (
                          <button
                            key={`${suggestion.todoItemId}-${suggestion.lastUsedAt}`}
                            type="button"
                            onClick={() => void handleAttachTodoLabel(suggestion.todoItemId, suggestion.title)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                              activeTodoItemId === suggestion.todoItemId
                                ? "border-[rgba(var(--accent-strong),0.7)] bg-[rgba(var(--accent),0.18)] text-white"
                                : "border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] text-[rgb(var(--muted))] hover:bg-[rgba(var(--bg),0.3)] hover:text-white"
                            }`}
                          >
                            {suggestion.title}
                          </button>
                        ))}
                      </div>
                    ) : !activeTodoItemTitle ? (
                      <p className="mt-2 text-sm text-[rgb(var(--muted))]">
                        No active to-do labels mapped to this project.
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-[rgb(var(--muted))]">
                      Attaching a to-do label does not change the timer task or start timing.
                    </p>
                  </div>
                </form>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-4">
                    <span className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Estimated finish</span>
                    <span className="mt-1 block text-lg font-semibold text-white">
                      {estimateFinishTime(1, settings.focusMinutes)}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-4 sm:text-right">
                    <span className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Daily goal</span>
                    <span className="mt-1 block text-lg font-semibold text-white">{dailyTargetHours.toFixed(1)}h</span>
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
