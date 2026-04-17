"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { FocusSession, Project, SessionMode } from "@/lib/domain";
import { useAppStore } from "@/lib/store";
import { clamp, formatLocalDateTime, parseLocalDateTime, uid } from "@/lib/utils";
import { useSessions } from "@/lib/hooks";

interface SessionModalProps {
  open: boolean;
  onClose: () => void;
  session?: FocusSession;
  projects: Project[];
}

export function SessionModal({ open, onClose, session, projects }: SessionModalProps) {
  const { addSession, deleteSession, error } = useSessions();
  
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const activeTaskName = useAppStore((state) => state.activeTaskName);

  const [mode, setMode] = useState<SessionMode>("focus");
  const [projectName, setProjectName] = useState("");
  const [taskName, setTaskName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("25");

  useEffect(() => {
    if (session) {
      setMode(session.mode);
      setProjectName(session.projectName ?? projects.find((project) => project.id === session.projectId)?.title ?? "");
      setTaskName(session.taskName ?? "");
      const startedAt = formatLocalDateTime(new Date(session.startedAt));
      const endedAt = formatLocalDateTime(new Date(session.endedAt));
      setStartTime(startedAt);
      setEndTime(endedAt);
      setDurationMinutes(String(Math.max(1, Math.round(session.actualDurationSec / 60))));
    } else {
      setMode("focus");
      setProjectName(projects.find((project) => project.id === activeProjectId)?.title ?? projects[0]?.title ?? "");
      setTaskName(activeTaskName ?? "");
      const now = new Date();
      setStartTime(formatLocalDateTime(now));
      setEndTime(formatLocalDateTime(new Date(now.getTime() + 25 * 60 * 1000)));
      setDurationMinutes("25");
    }
  }, [activeProjectId, activeTaskName, open, projects, session]);

  if (!open) return null;

  function syncEndTime(nextStartTime = startTime, nextDurationMinutes = durationMinutes) {
    const startDate = parseLocalDateTime(nextStartTime);
    const durationSec = Number(nextDurationMinutes) * 60;
    if (!startDate || !Number.isFinite(durationSec) || durationSec <= 0) {
      return;
    }
    setEndTime(formatLocalDateTime(new Date(startDate.getTime() + durationSec * 1000)));
  }

  function syncDuration(nextStartTime = startTime, nextEndTime = endTime) {
    const startDate = parseLocalDateTime(nextStartTime);
    const endDate = parseLocalDateTime(nextEndTime);
    if (!startDate || !endDate) {
      return;
    }
    const durationMinutesNext = clamp(Math.round((endDate.getTime() - startDate.getTime()) / 60000), 1, 24 * 60);
    setDurationMinutes(String(durationMinutesNext));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startDate = parseLocalDateTime(startTime);
    const endDate = parseLocalDateTime(endTime);
    const durationSecFromInput = Number(durationMinutes) * 60;
    const endTimeValid = Boolean(endDate);
    const startTimeValid = Boolean(startDate);
    const durationSec = Number.isFinite(durationSecFromInput) && durationSecFromInput > 0 ? durationSecFromInput : 0;
    const resolvedStart = startTimeValid ? startDate : null;
    const resolvedEnd = endTimeValid
      ? endDate
      : resolvedStart && durationSec > 0
        ? new Date(resolvedStart.getTime() + durationSec * 1000)
        : null;
    const finalDurationSec = resolvedStart && resolvedEnd ? Math.max(0, Math.round((resolvedEnd.getTime() - resolvedStart.getTime()) / 1000)) : durationSec;
    if (!resolvedStart || !resolvedEnd || finalDurationSec <= 0) {
      return;
    }

    const data: FocusSession = {
      id: session?.id ?? uid("session"),
      mode,
      projectId: null,
      projectName: projectName.trim() || null,
      taskId: null,
      taskName: taskName.trim() || null,
      startedAt: resolvedStart.toISOString(),
      endedAt: resolvedEnd.toISOString(),
      plannedDurationSec: finalDurationSec,
      actualDurationSec: finalDurationSec,
      completed: true,
      interrupted: false,
    };

    const savedId = await addSession(data); // addSession uses upsert in hook, so handles both edit/add
    if (savedId) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-200 rounded-[28px] bg-[rgb(var(--panel))] p-6 shadow-2xl border border-[rgb(var(--line))]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">{session ? "Edit Session" : "Log Session"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <label className="block text-xs font-medium uppercase tracking-wider text-[rgb(var(--muted))]">Mode</label>
            <div className="inline-flex w-fit rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted))]">
              {mode === "focus" ? "Focus" : "Historical session"}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[rgb(var(--muted))] mb-1.5">Start Time</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => {
                const nextStartTime = e.target.value;
                setStartTime(nextStartTime);
                syncEndTime(nextStartTime, durationMinutes);
              }}
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[rgb(var(--muted))] mb-1.5">
                End Time
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => {
                  const nextEndTime = e.target.value;
                  setEndTime(nextEndTime);
                  syncDuration(startTime, nextEndTime);
                }}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[rgb(var(--muted))] mb-1.5">
                Duration (min)
              </label>
              <input
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => {
                  const nextDuration = e.target.value;
                  setDurationMinutes(nextDuration);
                  syncEndTime(startTime, nextDuration);
                }}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[rgb(var(--muted))] mb-1.5">
                Project name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Type a project name"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[rgb(var(--muted))] mb-1.5">
                Task name
              </label>
              <input
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="Type a task name"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              Save failed: {error}
            </div>
          ) : null}

          <div className="pt-4 flex gap-3">
            {session && (
              <button
                type="button"
                onClick={async () => { if(confirm("Delete this session?")) { await deleteSession(session.id); onClose(); } }}
                className="px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition"
              >
                Delete
              </button>
            )}
            <button
              type="submit"
              className="flex-1 bg-white text-[rgb(var(--bg))] py-2.5 rounded-xl font-bold hover:bg-white/90 transition shadow-lg"
            >
              {session ? "Save Changes" : "Log Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
