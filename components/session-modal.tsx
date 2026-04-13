"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { FocusSession, TimerMode } from "@/lib/domain";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface SessionModalProps {
  open: boolean;
  onClose: () => void;
  session?: FocusSession; // If provided, we are editing
}

export function SessionModal({ open, onClose, session }: SessionModalProps) {
  const projects = useAppStore((state) => state.projects);
  const tasks = useAppStore((state) => state.tasks);
  const addSession = useAppStore((state) => state.addSession);
  const updateSession = useAppStore((state) => state.updateSession);
  const deleteSession = useAppStore((state) => state.deleteSession);

  const [mode, setMode] = useState<TimerMode>("focus");
  const [projectId, setProjectId] = useState<string>("");
  const [taskId, setTaskId] = useState<string>("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("25");

  useEffect(() => {
    if (session) {
      setMode(session.mode);
      setProjectId(session.projectId ?? "");
      setTaskId(session.taskId ?? "");
      setStartTime(new Date(session.startedAt).toISOString().slice(0, 16));
      setDurationMinutes(String(Math.round(session.actualDurationSec / 60)));
    } else {
      setMode("focus");
      setProjectId(projects[0]?.id ?? "");
      setTaskId("");
      setStartTime(new Date().toISOString().slice(0, 16));
      setDurationMinutes("25");
    }
  }, [session, projects, open]);

  if (!open) return null;

  const projectTasks = tasks.filter((t) => t.projectId === projectId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const start = new Date(startTime).toISOString();
    const durationSec = Number(durationMinutes) * 60;
    const end = new Date(new Date(startTime).getTime() + durationSec * 1000).toISOString();

    const data: Omit<FocusSession, "id"> = {
      mode,
      projectId: projectId || null,
      taskId: taskId || null,
      startedAt: start,
      endedAt: end,
      plannedDurationSec: durationSec,
      actualDurationSec: durationSec,
      completed: true,
      interrupted: false,
    };

    if (session) {
      updateSession(session.id, data);
    } else {
      addSession(data);
    }
    onClose();
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
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[rgb(var(--muted))] mb-1.5">Mode</label>
            <div className="flex gap-2">
              {(["focus", "shortBreak", "longBreak"] as TimerMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex-1 py-2 text-xs font-medium rounded-lg border transition",
                    mode === m 
                      ? "bg-white text-[rgb(var(--bg))] border-white" 
                      : "bg-white/5 border-white/10 text-[rgb(var(--muted))] hover:bg-white/10"
                  )}
                >
                  {m === "focus" ? "Focus" : m === "shortBreak" ? "Short" : "Long"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[rgb(var(--muted))] mb-1.5">Start Time</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[rgb(var(--muted))] mb-1.5">Duration (min)</label>
              <input
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div>
               <label className="block text-xs font-medium uppercase tracking-wider text-[rgb(var(--muted))] mb-1.5">Project</label>
               <select
                 value={projectId}
                 onChange={(e) => { setProjectId(e.target.value); setTaskId(""); }}
                 className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none"
               >
                 <option value="">None</option>
                 {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
               </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[rgb(var(--muted))] mb-1.5">Task (Optional)</label>
            <select
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none"
            >
              <option value="">No task</option>
              {projectTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>

          <div className="pt-4 flex gap-3">
            {session && (
              <button
                type="button"
                onClick={() => { if(confirm("Delete this session?")) { deleteSession(session.id); onClose(); } }}
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
