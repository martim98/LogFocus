"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BarChart3, CheckSquare, Clock3, FolderKanban, Settings2, ReceiptText } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn, formatDuration } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { useSettings } from "@/lib/hooks";
import { api } from "@/lib/api";
import { playSound } from "@/lib/sound";

const navItems = [
  { href: "/", label: "Today", icon: Clock3 },
  { href: "/projects", label: "Work", icon: FolderKanban },
  { href: "/todo-list", label: "To-do", icon: CheckSquare },
  { href: "/log", label: "Insights", icon: BarChart3 },
  { href: "/billable-log", label: "Billing", icon: ReceiptText },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { settings, loading: settingsLoading } = useSettings();

  const timer = useAppStore((state) => state.timer);
  const completeTimer = useAppStore((state) => state.completeTimer);

  useEffect(() => {
    if (pathname === "/login" || !timer.isRunning) {
      if (!timer.isRunning) document.title = "Sister Focus";
      return;
    }

    const handle = window.setInterval(() => {
      const startedAtMs = Date.parse(timer.startedAt!);
      const elapsedSec = Math.floor((Date.now() - startedAtMs) / 1000);
      const currentSec = Math.max(timer.remainingSec - elapsedSec, 0);

      if (currentSec <= 0) {
        const session = completeTimer(settings);
        void api.sessions.upsert(session);

        if (settings.soundEnabled) void playSound(settings.soundType);
        if (settings.notificationEnabled && Notification.permission === "granted") {
          new Notification(`${session.mode === "focus" ? "Focus" : "Break"} complete`, {
            body: session.mode === "focus" ? "Take a reset before the next block." : "Time to move back into focus.",
          });
        }
      }

      const modeLabel = timer.mode === "focus" ? "Focus" : timer.mode === "shortBreak" ? "Short Break" : "Long Break";
      document.title = `${formatDuration(currentSec)} · ${modeLabel}`;
    }, 1000);

    return () => window.clearInterval(handle);
  }, [pathname, timer.isRunning, timer.startedAt, timer.remainingSec, timer.mode, settings, completeTimer]);

  if (pathname === "/login") return <>{children}</>;

  if (settingsLoading) {
    return (
      <div className="shell-fallback flex min-h-[60vh] items-center justify-center">
        <div className="shell-loading">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgb(var(--accent))] border-t-transparent" />
            <p className="text-sm font-medium text-[rgb(var(--muted))]">Loading your workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell-fallback">
      <header className="shell-header">
        <Link href="/" className="shell-brand">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[rgb(var(--bg))] shadow-sm">
            <Clock3 className="h-4 w-4" />
          </div>
          <span className="text-xl font-semibold tracking-tight">Sister Focus</span>
        </Link>
        <nav className="shell-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
              className={cn(
                "shell-pill text-sm font-medium",
                active
                  ? "bg-[rgba(var(--accent),0.16)] text-white ring-1 ring-[rgba(var(--accent),0.35)] shadow-sm"
                  : "bg-[rgba(var(--line),0.22)] text-[rgba(255,255,255,0.68)] hover:bg-[rgba(var(--line),0.38)] hover:text-white",
              )}
            >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <div className="shell-pill bg-[rgba(var(--line),0.22)] text-[rgba(255,255,255,0.7)]">Local-only workspace</div>
        </nav>
      </header>

      {children}
    </div>
  );
}
