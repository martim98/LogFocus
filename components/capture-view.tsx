"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Clock, AlertTriangle, CheckCircle2, Zap, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

type DraftTask = {
  id: string;
  project: string;
  task: string;
  hours: number;
  urgency: number; // 0 = now, 0.5 = later today, 1 = tomorrow, etc.
  completed: boolean;
};

export function CaptureView() {
  const addTask = useAppStore((state) => state.addTask);
  const projects = useAppStore((state) => state.projects);
  const addProject = useAppStore((state) => state.addProject);
  const [drafts, setDrafts] = useState<DraftTask[]>([
    { id: "1", project: "", task: "", hours: 1, urgency: 0, completed: false },
  ]);

  // Keep track of "now" for real-time risk calculation
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const addRow = () => {
    setDrafts([...drafts, { 
      id: Math.random().toString(36).slice(2, 9), 
      project: "", 
      task: "", 
      hours: 1, 
      urgency: 0,
      completed: false 
    }]);
  };

  const removeRow = (id: string) => {
    setDrafts(drafts.filter((d) => d.id !== id));
  };

  const updateRow = (id: string, updates: Partial<DraftTask>) => {
    setDrafts(drafts.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  };

  const handleCommit = (draft: DraftTask) => {
    if (!draft.task.trim()) return;

    // 1. Find or create project
    let projectId = projects.find(p => p.title.toLowerCase() === draft.project.trim().toLowerCase())?.id;
    if (!projectId && draft.project.trim()) {
      projectId = addProject(draft.project.trim());
    } else if (!projectId) {
      projectId = projects[0]?.id;
    }

    // 2. Add as real task (1 hour approx 2 pomodoros)
    const estimate = Math.max(1, Math.round(draft.hours * 2));
    addTask(projectId || "project_general", draft.task.trim(), estimate);

    // 3. Mark as "pushed" or remove
    removeRow(draft.id);
  };

  const processedTasks = useMemo(() => {
    const active = drafts.filter(d => !d.completed);
    
    // 1. Sort by Urgency (Ascending - sooner first)
    // 2. Then by Hours (Descending - larger tasks first)
    const sorted = [...active].sort((a, b) => {
      if (a.urgency !== b.urgency) return a.urgency - b.urgency;
      return b.hours - a.hours;
    });

    const workDayStart = 9;
    const workDayEnd = 18;
    
    // Calculate current available start time
    let currentHour = now.getHours() + now.getMinutes() / 60;
    
    // If before 9am, assume we start at 9am
    if (currentHour < workDayStart) currentHour = workDayStart;
    
    let accumulatedHours = 0;

    return sorted.map(task => {
      const startForTask = currentHour + accumulatedHours;
      accumulatedHours += task.hours;
      const endForTask = startForTask + task.hours;
      
      // Risk Calculation:
      // A task is "At Risk" if it's due today (urgency < 1) 
      // AND its estimated finish time exceeds the 18:00 cutoff.
      const isAtRisk = task.urgency < 1 && endForTask > workDayEnd;

      return { 
        ...task, 
        estimatedFinishHour: endForTask, 
        isAtRisk 
      };
    });
  }, [drafts, now]);

  const formatTime = (decimalHour: number) => {
    const h = Math.floor(decimalHour);
    const m = Math.round((decimalHour % 1) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  return (
    <main className="flex flex-col gap-6">
      <section className="panel rounded-[30px] p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Priority Capture</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Capacity Planner.</h1>
          </div>
          <div className="text-right">
             <p className="text-xs font-bold text-[rgb(var(--muted))] uppercase">Current Window</p>
             <p className="text-lg font-mono font-semibold text-white">09:00 — 18:00</p>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[rgb(var(--muted))]">
          Enter your roadmap below. We'll automatically sequence them by urgency and alert you if your workload exceeds the 18:00 daily capacity. 
          <span className="ml-1 text-[rgb(var(--accent-alt))] font-medium">Urgency: 0 = Today, 1 = Tomorrow.</span>
        </p>
      </section>

      <div className="panel overflow-hidden rounded-[24px]">
        <div className="bg-[rgba(var(--accent),0.06)] px-5 py-3 border-b border-[rgb(var(--line))] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--muted))]">Planned Sequence</h3>
          <span className="text-[10px] text-[rgb(var(--muted))] uppercase font-bold tabular-nums">
            {processedTasks.length} Pending Tasks
          </span>
        </div>
        
        <div className="p-4 flex flex-col gap-2">
          {processedTasks.length === 0 && (
            <div className="py-12 text-center text-[rgb(var(--muted))] text-sm italic">
              All tasks cleared. Add a row to start planning your capacity.
            </div>
          )}

          {processedTasks.map((draft) => (
            <div key={draft.id} className={cn(
              "group flex items-center gap-3 p-2 rounded-2xl transition-all border border-transparent",
              draft.isAtRisk ? "bg-red-500/5 border-red-500/20" : "hover:bg-white/5"
            )}>
              {/* Complete Toggle */}
              <button
                onClick={() => updateRow(draft.id, { completed: true })}
                className="p-2 text-[rgb(var(--line))] hover:text-[rgb(var(--accent-alt))] transition shrink-0"
                title="Mark as complete"
              >
                <CheckCircle2 className="h-5 w-5" />
              </button>

              {/* Data Grid */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                {/* Project */}
                <div className="lg:col-span-3">
                  <input
                    type="text"
                    value={draft.project}
                    onChange={(e) => updateRow(draft.id, { project: e.target.value })}
                    placeholder="Project Title"
                    className="w-full rounded-xl border border-[rgba(var(--line),0.3)] bg-[rgba(var(--bg),0.2)] px-3 py-2.5 text-sm text-white placeholder:text-[rgba(255,255,255,0.2)] focus:border-[rgb(var(--accent))] outline-none transition"
                  />
                </div>

                {/* Task */}
                <div className="lg:col-span-5">
                  <input
                    type="text"
                    value={draft.task}
                    onChange={(e) => updateRow(draft.id, { task: e.target.value })}
                    placeholder="What needs to be done?"
                    className="w-full rounded-xl border border-[rgba(var(--line),0.3)] bg-[rgba(var(--bg),0.2)] px-3 py-2.5 text-sm text-white placeholder:text-[rgba(255,255,255,0.2)] focus:border-[rgb(var(--accent))] outline-none transition"
                  />
                </div>

                {/* Hours */}
                <div className="lg:col-span-2 flex items-center gap-2 bg-[rgba(var(--line),0.15)] rounded-xl px-3 py-2.5">
                  <Clock className="h-4 w-4 text-[rgb(var(--muted))]" />
                  <input
                    type="number"
                    step={0.5}
                    min={0.5}
                    value={draft.hours}
                    onChange={(e) => updateRow(draft.id, { hours: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-transparent text-sm text-white outline-none font-medium tabular-nums"
                  />
                  <span className="text-[10px] text-[rgb(var(--muted))] font-bold">HRS</span>
                </div>

                {/* Urgency */}
                <div className="lg:col-span-2 flex items-center gap-2 bg-[rgba(var(--line),0.15)] rounded-xl px-3 py-2.5">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={draft.urgency}
                    onChange={(e) => updateRow(draft.id, { urgency: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-transparent text-sm text-white outline-none font-medium tabular-nums"
                  />
                  <span className="text-[10px] text-[rgb(var(--muted))] font-bold uppercase">DAYS</span>
                </div>
              </div>

              {/* Analytics / Status */}
              <div className="hidden xl:flex w-28 flex-col items-end justify-center shrink-0">
                {draft.isAtRisk ? (
                  <div className="flex items-center gap-1 text-[10px] font-black text-red-400 uppercase tracking-tighter animate-pulse">
                    <AlertTriangle className="h-3 w-3" />
                    At Risk
                  </div>
                ) : (
                  <div className="text-[10px] font-bold text-[rgb(var(--muted))] uppercase tracking-tighter">
                    Healthy
                  </div>
                )}
                <div className="text-[10px] text-[rgb(var(--muted))] font-mono tabular-nums">
                  ETA {formatTime(draft.estimatedFinishHour)}
                </div>
              </div>

              {/* Commit to Workspace */}
              <button
                onClick={() => handleCommit(draft)}
                disabled={!draft.task.trim()}
                className="ml-2 flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-[rgb(var(--bg))] transition hover:bg-white/90 disabled:opacity-30"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Add</span>
              </button>

              {/* Delete */}
              <button
                onClick={() => removeRow(draft.id)}
                className="p-2.5 text-[rgb(var(--line))] hover:text-red-400 transition shrink-0"
                title="Remove entry"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          
          <div className="mt-6 flex justify-center">
            <button
              onClick={addRow}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[rgb(var(--accent-strong))] px-8 py-4 text-sm font-bold text-white transition hover:opacity-90 shadow-xl group"
            >
              <Plus className="h-5 w-5 transition-transform group-hover:scale-110" />
              <span>Create New Planning Row</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
