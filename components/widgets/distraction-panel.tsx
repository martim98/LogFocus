"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Inbox, Plus, SquarePen } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function DistractionPanel() {
  const [content, setContent] = useState("");
  const todayKey = useAppStore((state) => state.todayKey);
  const distractionsByDate = useAppStore((state) => state.distractionsByDate);
  const addDistraction = useAppStore((state) => state.addDistraction);
  const resolveDistraction = useAppStore((state) => state.resolveDistraction);
  const convertDistractionToTask = useAppStore((state) => state.convertDistractionToTask);
  const distractions = distractionsByDate[todayKey] ?? [];

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) {
      return;
    }
    addDistraction(content.trim());
    setContent("");
  }

  return (
    <section className="panel rounded-[30px] p-6">
      <h2 className="text-xl font-semibold">Distraction inbox</h2>
      <p className="mt-2 text-sm text-[rgb(var(--muted))]">Dump off-topic thoughts here so they stop competing with the current block.</p>
      <form onSubmit={onSubmit} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          value={content}
          onChange={(event) => setContent(event.currentTarget.value)}
          placeholder="Capture a distraction or reminder"
          className="rounded-2xl border border-[rgb(var(--line))] bg-transparent px-4 py-3"
        />
        <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[rgb(var(--accent-strong))] px-4 py-3 text-sm font-medium text-white">
          <Plus className="h-4 w-4" />
          Capture
        </button>
      </form>
      <div className="mt-5 grid gap-3">
        {distractions.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[rgb(var(--line))] px-4 py-6 text-sm text-[rgb(var(--muted))]">
            Inbox is empty. Keep it that way until something genuinely needs to be captured.
          </div>
        ) : (
          distractions
            .slice()
            .reverse()
            .map((item) => (
              <article
                key={item.id}
                className={cn(
                  "rounded-[24px] border px-4 py-4",
                  item.resolved ? "border-[rgba(var(--accent),0.35)] bg-[rgba(var(--accent),0.1)]" : "border-[rgb(var(--line))] bg-[rgba(var(--panel),0.76)]",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={cn("font-medium", item.resolved && "line-through opacity-70")}>{item.content}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">
                      {new Date(item.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => resolveDistraction(item.id)} className="rounded-full p-2 text-[rgb(var(--muted))] hover:bg-[rgba(var(--accent),0.12)]">
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => convertDistractionToTask(item.id)} className="rounded-full p-2 text-[rgb(var(--muted))] hover:bg-[rgba(var(--accent),0.12)]">
                      <SquarePen className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {item.linkedTaskId ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[rgba(var(--accent),0.14)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">
                    <Inbox className="h-3.5 w-3.5" />
                    Converted to task
                  </div>
                ) : null}
              </article>
            ))
        )}
      </div>
    </section>
  );
}
