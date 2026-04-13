"use client";

import { FormEvent, useState } from "react";
import { useAppStore } from "@/lib/store";
import { themeSchema } from "@/lib/domain";

export function SettingsView() {
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const syncTheme = useAppStore((state) => state.syncTheme);
  const [notificationState, setNotificationState] = useState<string>("");

  async function requestNotifications() {
    if (typeof Notification === "undefined") {
      setNotificationState("This browser does not support notifications.");
      return;
    }

    const permission = await Notification.requestPermission();
    updateSettings({ notificationEnabled: permission === "granted" });
    setNotificationState(permission === "granted" ? "Notifications enabled." : "Notifications remain disabled.");
  }

  function onNumberChange(key: "focusMinutes" | "shortBreakMinutes" | "longBreakMinutes" | "longBreakEvery", value: string) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      updateSettings({ [key]: parsed } as Partial<typeof settings>);
    }
  }

  function onThemeChange(event: FormEvent<HTMLSelectElement>) {
    const parsed = themeSchema.safeParse(event.currentTarget.value);
    if (!parsed.success) {
      return;
    }
    updateSettings({ theme: parsed.data });
    syncTheme();
  }

  return (
    <main className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="panel rounded-[30px] p-6 sm:p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Shape the workspace to your rhythm.</h1>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <NumberField label="Focus minutes" value={settings.focusMinutes} onChange={(value) => onNumberChange("focusMinutes", value)} />
          <NumberField
            label="Short break"
            value={settings.shortBreakMinutes}
            onChange={(value) => onNumberChange("shortBreakMinutes", value)}
          />
          <NumberField label="Long break" value={settings.longBreakMinutes} onChange={(value) => onNumberChange("longBreakMinutes", value)} />
          <NumberField label="Long break every" value={settings.longBreakEvery} onChange={(value) => onNumberChange("longBreakEvery", value)} />
        </div>
        <div className="mt-8 grid gap-4">
          <ToggleRow label="Auto-start breaks" checked={settings.autoStartBreaks} onChange={(checked) => updateSettings({ autoStartBreaks: checked })} />
          <ToggleRow label="Auto-start focus" checked={settings.autoStartFocus} onChange={(checked) => updateSettings({ autoStartFocus: checked })} />
          <ToggleRow label="Sound enabled" checked={settings.soundEnabled} onChange={(checked) => updateSettings({ soundEnabled: checked })} />
        </div>
      </section>
      <section className="flex flex-col gap-6">
        <div className="panel rounded-[30px] p-6">
          <h2 className="text-xl font-semibold">Appearance and alerts</h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm">
              <span className="text-[rgb(var(--muted))]">Theme</span>
              <select
                value={settings.theme}
                onChange={onThemeChange}
                className="rounded-2xl border border-[rgb(var(--line))] bg-transparent px-4 py-3"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-[rgb(var(--muted))]">Sound type</span>
              <select
                value={settings.soundType}
                onChange={(event) => updateSettings({ soundType: event.currentTarget.value as typeof settings.soundType })}
                className="rounded-2xl border border-[rgb(var(--line))] bg-transparent px-4 py-3"
              >
                <option value="bell">Bell</option>
                <option value="chime">Chime</option>
                <option value="none">None</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={requestNotifications}
            className="mt-5 rounded-full bg-[rgb(var(--accent-strong))] px-5 py-3 text-sm font-medium text-white"
          >
            Enable browser notifications
          </button>
          {notificationState ? <p className="mt-3 text-sm text-[rgb(var(--muted))]">{notificationState}</p> : null}
        </div>
        <div className="panel rounded-[30px] p-6">
          <h2 className="text-xl font-semibold">What ships in this MVP</h2>
          <ul className="mt-4 grid gap-3 text-sm text-[rgb(var(--muted))]">
            <li>Local-first persistence with no required account</li>
            <li>Timer-driven projects, tasks, capture, and history</li>
            <li>Mobile-friendly layout optimized for browser use</li>
            <li>Clear extension path for later sync and integrations</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-[rgb(var(--muted))]">{label}</span>
      <input
        type="number"
        value={value}
        min={1}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="rounded-2xl border border-[rgb(var(--line))] bg-transparent px-4 py-3"
      />
    </label>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-[22px] border border-[rgb(var(--line))] px-4 py-3">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 rounded-full transition ${checked ? "bg-[rgb(var(--accent-strong))]" : "bg-[rgba(var(--line),0.9)]"}`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${checked ? "left-7" : "left-1"}`}
        />
      </button>
    </label>
  );
}
