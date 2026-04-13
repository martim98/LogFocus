"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { BarChart3, Clock3, FolderKanban, Settings2, LayoutGrid } from "lucide-react";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { cn, formatDuration } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { setStorageNamespace } from "@/lib/repository";
import { playSound } from "@/lib/sound";

const navItems = [
  { href: "/", label: "Today", icon: Clock3 },
  { href: "/capture", label: "Task Entry", icon: LayoutGrid },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/log", label: "Log", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();
  const load = useAppStore((state) => state.load);
  const hydrated = useAppStore((state) => state.hydrated);
  const syncWithCloud = useAppStore((state) => state.syncWithCloud);
  const timer = useAppStore((state) => state.timer);
  const settings = useAppStore((state) => state.settings);
  const tick = useAppStore((state) => state.tick);
  const loadedNamespaceRef = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === "/login") {
      return;
    }

    const namespace = user?.id ?? "guest";
    setStorageNamespace(namespace);
    if (loadedNamespaceRef.current !== namespace) {
      load();
      if (user?.id) {
        void syncWithCloud(user.id);
      }
      loadedNamespaceRef.current = namespace;
    }
  }, [load, pathname, syncWithCloud, user?.id]);

  useEffect(() => {
    if (pathname === "/login") {
      return;
    }

    if (!timer.isRunning) {
      document.title = "Sister Focus";
      return;
    }

    const handle = window.setInterval(() => {
      const completedSession = tick();

      // Update document title manually to avoid state re-render
      if (timer.startedAt) {
        const startedAtMs = Date.parse(timer.startedAt);
        const elapsedSec = Math.floor((Date.now() - startedAtMs) / 1000);
        const currentSec = Math.max(timer.remainingSec - elapsedSec, 0);
        const modeLabel =
          timer.mode === "focus" ? "Focus" : timer.mode === "shortBreak" ? "Short Break" : "Long Break";
        document.title = `${formatDuration(currentSec)} · ${modeLabel}`;
      }

      if (completedSession && settings.soundEnabled) {
        void playSound(settings.soundType);
      }
      if (
        completedSession &&
        settings.notificationEnabled &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification(`${completedSession.mode === "focus" ? "Focus" : "Break"} complete`, {
          body:
            completedSession.mode === "focus"
              ? "Take a reset before the next block."
              : "Time to move back into focus.",
        });
      }
    }, 1000);

    return () => window.clearInterval(handle);
  }, [
    pathname,
    settings.focusMinutes,
    settings.longBreakMinutes,
    settings.notificationEnabled,
    settings.shortBreakMinutes,
    settings.soundEnabled,
    settings.soundType,
    tick,
    timer.isRunning,
    timer.mode,
    timer.startedAt,
  ]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (!hydrated) {
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
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[rgb(var(--bg))]">
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
                    ? "bg-[rgba(var(--accent),0.2)] text-white ring-1 ring-[rgba(var(--accent),0.5)]"
                    : "bg-[rgba(var(--line),0.3)] text-[rgba(255,255,255,0.7)] hover:bg-[rgba(var(--line),0.5)] hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <div className="shell-pill bg-transparent p-0">
            <UserButton />
          </div>
        </nav>
      </header>

      {children}
    </div>
  );
}
