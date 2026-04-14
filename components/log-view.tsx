"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildTimeline,
  getDailyProductivity,
  formatSecondsToHoursMinutes,
} from "@/lib/analytics";
import { FocusSession, Task } from "@/lib/domain";
import { useAppStore } from "@/lib/store";
import { formatMinutes, getDateKey } from "@/lib/utils";
import { ReportExportDialog } from "@/components/report-export-dialog";
import { SessionModal } from "@/components/session-modal";
import { StatsStrip } from "@/components/widgets/stats-strip";
import { Download, Plus, Clock, Zap, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "daily" | "trends";

export function LogView() {
  const [tab, setTab] = useState<Tab>("daily");
  const [exportOpen, setExportOpen] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<FocusSession | undefined>();
  const projects = useAppStore((state) => state.projects);
  const sessions = useAppStore((state) => state.sessions);
  const tasks = useAppStore((state) => state.tasks);

  const orderedProjects = projects.slice().sort((a, b) => a.order - b.order);
  const projectLabelById = new Map(orderedProjects.map((p) => [p.id, p.title]));
  const taskById = new Map(tasks.map((t) => [t.id, { title: t.title, projectId: t.projectId }]));

  return (
    <main className="flex flex-col gap-6">
      <StatsStrip />
      <ReportExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <SessionModal
        open={sessionModalOpen}
        session={selectedSession}
        onClose={() => {
          setSessionModalOpen(false);
          setSelectedSession(undefined);
        }}
      />

      {/* Header */}
      <section className="panel rounded-[30px] p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Insights & Log</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Every minute accounted for.</h1>
          </div>
          <div className="flex flex-wrap gap-2 self-start">
            <button
              type="button"
              onClick={() => {
                setSelectedSession(undefined);
                setSessionModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/20"
            >
              <Plus className="h-4 w-4" />
              Log Session
            </button>
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[rgb(var(--bg))] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

      </section>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["daily", "trends"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium capitalize transition",
              tab === t
                ? "bg-[rgba(255,255,255,0.22)] text-white"
                : "bg-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.6)] hover:text-white",
            )}
          >
            {t === "daily" ? "Daily Review" : "Trends"}
          </button>
        ))}
      </div>

      {tab === "daily" && (
        <DailyReviewTab
          sessions={sessions}
          projectLabelById={projectLabelById}
          taskById={taskById}
          onEditSession={(s) => {
            setSelectedSession(s);
            setSessionModalOpen(true);
          }}
        />
      )}

      {tab === "trends" && <ChartsTab sessions={sessions} />}
    </main>
  );
}

function DailyReviewTab({
  sessions,
  projectLabelById,
  taskById,
  onEditSession,
}: {
  sessions: FocusSession[];
  projectLabelById: Map<string, string>;
  taskById: Map<string, Pick<Task, "title" | "projectId">>;
  onEditSession: (session: FocusSession) => void;
}) {
  const dates = Array.from(new Set(sessions.map((s) => getDateKey(new Date(s.startedAt))))).sort((a, b) =>
    b.localeCompare(a)
  );

  if (dates.length === 0) {
    return (
      <section className="panel rounded-[30px] p-8 text-center text-[rgb(var(--muted))] text-sm">
        No focus sessions logged yet. Run your first pomodoro to start the review.
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-8">
      {dates.map((dateKey) => {
        const dayProductivity = getDailyProductivity(sessions, dateKey);
        const daySessions = sessions
          .filter((s) => getDateKey(new Date(s.startedAt)) === dateKey)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

        return (
          <div key={dateKey} className="flex flex-col gap-4">
            {/* 1. Productivity Card for this day */}
            {dayProductivity && <ProductivityDayCard dateKey={dateKey} stats={dayProductivity} />}

            {/* 2. Session Table for this day */}
            <div className="panel overflow-hidden rounded-[24px]">
              <div className="bg-[rgba(var(--accent),0.06)] px-5 py-3 border-b border-[rgb(var(--line))]">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--muted))]">Session Log</h3>
              </div>
              <table className="min-w-full divide-y divide-[rgb(var(--line))] text-left text-sm">
                <tbody className="divide-y divide-[rgb(var(--line))] bg-[rgba(var(--panel),0.4)]">
                  {daySessions.map((session) => {
                    const task = session.taskId ? taskById.get(session.taskId) : null;
                    const projectId = session.projectId ?? task?.projectId ?? null;
                    const projectLabel = (projectId ? projectLabelById.get(projectId) : null) ?? session.projectName ?? null;
                    const taskLabel = task?.title ?? session.taskName ?? (session.mode === "focus" ? "Project only" : "Break");
                    const durationMin = Math.round(session.actualDurationSec / 60);
                    return (
                      <tr
                        key={session.id}
                        onClick={() => onEditSession(session)}
                        className="cursor-pointer hover:bg-white/5 transition"
                      >
                        <td className="px-5 py-3.5 text-[rgb(var(--muted))] w-24">
                          {new Date(session.startedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {projectLabel && (
                              <span className="rounded-md bg-[rgba(var(--accent),0.12)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                                {projectLabel}
                              </span>
                            )}
                            <span className="text-white font-medium">{taskLabel}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                          {formatMinutes(durationMin)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function ProductivityDayCard({
  dateKey,
  stats,
}: {
  dateKey: string;
  stats: NonNullable<ReturnType<typeof getDailyProductivity>>;
}) {
  const dayLabel = new Date(dateKey + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="rounded-2xl border border-[rgb(var(--line))] bg-[rgba(var(--panel),0.5)] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">
            {dayLabel} {stats.isToday && "(Today)"}
          </h3>
          <div className="mt-1 flex items-center gap-3 text-sm text-[rgb(var(--muted))]">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Started:{" "}
              {new Date(stats.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" />
              Active: {formatSecondsToHoursMinutes(stats.workTimeSec)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium">Score</p>
            <p className="text-2xl font-bold text-[rgb(var(--accent-alt))]">
              {Math.round(stats.productivityScore)}%
            </p>
          </div>
          <div className="h-12 w-12 rounded-full border-4 border-[rgba(var(--line),0.3)] flex items-center justify-center">
            <div
              className="h-10 w-10 rounded-full border-4 border-[rgb(var(--accent-alt))] border-t-transparent"
              style={{ transform: `rotate(${stats.productivityScore * 3.6}deg)` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-xs text-[rgb(var(--muted))]">Total Elapsed</p>
          <p className="text-lg font-medium">{formatSecondsToHoursMinutes(stats.totalElapsedSec)}</p>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-xs text-[rgb(var(--muted))]">Actual Work</p>
          <p className="text-lg font-medium">{formatSecondsToHoursMinutes(stats.workTimeSec)}</p>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[rgb(var(--muted))]">Inefficiency</p>
            {stats.inefficiencySec > stats.workTimeSec && (
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            )}
          </div>
          <p className="text-lg font-medium">{formatSecondsToHoursMinutes(stats.inefficiencySec)}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[rgba(var(--line),0.3)]">
        <div
          className="h-full bg-[rgb(var(--accent-alt))] transition-all duration-1000"
          style={{ width: `${stats.productivityScore}%` }}
        />
      </div>
    </div>
  );
}

function ChartsTab({ sessions }: { sessions: FocusSession[] }) {
  const sevenDay = buildTimeline(sessions, 7);
  const thirtyDay = buildTimeline(sessions, 30);

  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <ChartCard title="Last 7 days" subtitle="Focus minutes per day">
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
        <ChartCard title="Last 30 days" subtitle="Logged sessions per day">
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
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="panel rounded-[30px] p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-[rgb(var(--muted))]">{subtitle}</p>
      <div className="mt-4 h-[260px]">{children}</div>
    </div>
  );
}
