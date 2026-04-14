"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";
import { buildTimeline, getLoggedFocusSessions, getProjectStats, getTodayStats } from "@/lib/analytics";
import { useAppStore } from "@/lib/store";
import { formatMinutes } from "@/lib/utils";
import { ReportExportDialog } from "@/components/report-export-dialog";
import { Download } from "lucide-react";

export function HistoryView() {
  const [exportOpen, setExportOpen] = useState(false);
  const todayKey = useAppStore((state) => state.todayKey);
  const projects = useAppStore((state) => state.projects);
  const sessions = useAppStore((state) => state.sessions);
  const tasks = useAppStore((state) => state.tasks);
  const plansByDate = useAppStore((state) => state.plansByDate);
  const planItems = plansByDate[todayKey] ?? [];

  const orderedProjects = projects.slice().sort((a, b) => a.order - b.order);
  const sevenDay = buildTimeline(sessions, 7);
  const thirtyDay = buildTimeline(sessions, 30);
  const todayStats = getTodayStats(sessions, tasks, planItems);
  const focusSessions = getLoggedFocusSessions(sessions).slice().reverse();
  const projectLabelById = new Map(orderedProjects.map((project) => [project.id, project.title]));

  return (
    <main className="flex flex-col gap-6">
      <ReportExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <section className="panel rounded-[30px] p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[rgb(var(--muted))]">History</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">See the shape of your work.</h1>
          </div>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[rgb(var(--bg))] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Today focus" value={todayStats.focusLabel} />
          <StatCard label="Logged sessions" value={String(todayStats.loggedSessions)} />
          <StatCard label="Finished tasks" value={`${todayStats.tasksDone}/${todayStats.totalTasks || 0}`} />
          <StatCard label="Projects" value={String(orderedProjects.length)} />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {orderedProjects.map((project) => {
            const stats = getProjectStats(project.id, sessions, tasks);
            return (
              <div key={project.id} className="rounded-[24px] border border-[rgb(var(--line))] bg-[rgba(var(--panel),0.82)] p-4">
                <p className="text-sm text-[rgb(var(--muted))]">{project.title}</p>
                <p className="mt-2 text-2xl font-semibold">{stats.focusLabel}</p>
                <p className="mt-2 text-sm text-[rgb(var(--muted))]">
                  {stats.loggedSessions} logged · {stats.tasksDone}/{stats.totalTasks} tasks
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Last 7 days" subtitle="Focus minutes by day">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={sevenDay}>
              <defs>
                <linearGradient id="minutesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgb(var(--accent-strong))" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="rgb(var(--accent-strong))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(var(--line),0.8)" vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="minutes" stroke="rgb(var(--accent-strong))" fill="url(#minutesGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Last 30 days" subtitle="Logged sessions by day">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={thirtyDay}>
              <CartesianGrid stroke="rgba(var(--line),0.8)" vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="sessions" fill="rgb(var(--accent-alt))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="panel rounded-[30px] p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Recent logged focus sessions</h2>
            <p className="mt-2 text-sm text-[rgb(var(--muted))]">Every interruption fragment and completed focus block lands here automatically.</p>
          </div>
          <div className="rounded-full border border-[rgb(var(--line))] px-4 py-2 text-sm text-[rgb(var(--muted))]">
            {formatMinutes(Math.round(focusSessions.reduce((sum, session) => sum + session.actualDurationSec, 0) / 60))} tracked
          </div>
        </div>
        <div className="mt-6 overflow-hidden rounded-[24px] border border-[rgb(var(--line))]">
          <table className="min-w-full divide-y divide-[rgb(var(--line))] text-left text-sm">
            <thead className="bg-[rgba(var(--accent),0.08)]">
              <tr>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Project / Task</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--line))] bg-[rgba(var(--panel),0.82)]">
              {focusSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-[rgb(var(--muted))]">
                    No logged focus sessions yet. Run a focus block and the history view will begin to fill in.
                  </td>
                </tr>
              ) : (
                focusSessions.slice(0, 12).map((session) => {
                  const task = tasks.find((entry) => entry.id === session.taskId);
                  const projectLabel =
                    (session.projectId ? projectLabelById.get(session.projectId) : null) ??
                    (task ? projectLabelById.get(task.projectId ?? "") : null) ??
                    session.projectName ??
                    null;
                  const taskLabel = task?.title ?? session.taskName ?? "Unassigned";
                  return (
                    <tr key={session.id}>
                      <td className="px-4 py-3">{new Date(session.startedAt).toLocaleString()}</td>
                      <td className="px-4 py-3">{Math.round(session.actualDurationSec / 60)} min</td>
                      <td className="px-4 py-3">
                        {projectLabel ? `${projectLabel} / ${taskLabel}` : taskLabel}
                      </td>
                      <td className="px-4 py-3 text-[rgb(var(--muted))]">{session.interrupted ? "Interrupted" : "Completed"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-[rgb(var(--line))] bg-[rgba(var(--panel),0.82)] p-4">
      <p className="text-sm text-[rgb(var(--muted))]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="panel rounded-[30px] p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-[rgb(var(--muted))]">{subtitle}</p>
      <div className="mt-4 h-[260px]">{children}</div>
    </div>
  );
}
