"use client";

import { FormEvent, useMemo, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useAppStore } from "@/lib/store";

export function NotesPanel() {
  const [content, setContent] = useState("");
  const timer = useAppStore((state) => state.timer);
  const sessions = useAppStore((state) => state.sessions);
  const notesBySession = useAppStore((state) => state.notesBySession);
  const addSessionNote = useAppStore((state) => state.addSessionNote);

  const sessionId = timer.activeSessionId ?? sessions.at(-1)?.id ?? null;
  const notes = useMemo(() => (sessionId ? notesBySession[sessionId] ?? [] : []), [notesBySession, sessionId]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) {
      return;
    }
    addSessionNote(content.trim());
    setContent("");
  }

  return (
    <section className="panel rounded-[30px] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Session notes</h2>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">Capture decisions or context without leaving the timer.</p>
        </div>
        <div className="rounded-full border border-[rgb(var(--line))] px-4 py-2 text-sm text-[rgb(var(--muted))]">
          {sessionId ? "Attached to current session" : "No session yet"}
        </div>
      </div>
      <form onSubmit={onSubmit} className="mt-5 grid gap-3">
        <textarea
          value={content}
          onChange={(event) => setContent(event.currentTarget.value)}
          rows={4}
          placeholder={sessionId ? "Write a note for this session" : "Start or finish a session to attach notes"}
          className="rounded-[24px] border border-[rgb(var(--line))] bg-transparent px-4 py-3"
        />
        <button
          type="submit"
          disabled={!sessionId}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[rgb(var(--accent-strong))] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Add note
        </button>
      </form>
      <div className="mt-5 grid gap-3">
        {notes.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[rgb(var(--line))] px-4 py-6 text-sm text-[rgb(var(--muted))]">
            No notes for the current or latest session yet.
          </div>
        ) : (
          notes
            .slice()
            .reverse()
            .map((note) => (
              <article key={note.id} className="rounded-[24px] border border-[rgb(var(--line))] bg-[rgba(var(--panel),0.76)] px-4 py-4">
                <p className="whitespace-pre-wrap text-sm leading-6">{note.content}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">
                  {new Date(note.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </article>
            ))
        )}
      </div>
    </section>
  );
}
