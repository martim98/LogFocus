"use client";

import { FormEvent, useState } from "react";
import { themeSchema } from "@/lib/domain";
import { useSettings } from "@/lib/hooks";

export function SettingsView() {
  const { settings, updateSettings, loading, error } = useSettings();
  const [notificationState, setNotificationState] = useState<string>("");

  async function requestNotifications() {
    if (typeof Notification === "undefined") {
      setNotificationState("This browser does not support notifications.");
      return;
    }

    const permission = await Notification.requestPermission();
    await updateSettings({ notificationEnabled: permission === "granted" });
    setNotificationState(permission === "granted" ? "Notifications enabled." : "Notifications remain disabled.");
  }

  async function onNumberChange(key: "focusMinutes" | "shortBreakMinutes" | "longBreakMinutes" | "longBreakEvery", value: string) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      await updateSettings({ [key]: parsed });
    }
  }

  async function onThemeChange(event: FormEvent<HTMLSelectElement>) {
    const parsed = themeSchema.safeParse(event.currentTarget.value);
    if (!parsed.success) {
      return;
    }
    await updateSettings({ theme: parsed.data });
  }

  if (loading) return <div>Loading settings...</div>;

  return (
    <main className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
      <section className="panel rounded-[28px] p-6 sm:p-7">
        <p className="text-sm uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Shape the workspace to your rhythm.</h1>
        <p className="mt-2 max-w-2xl text-sm text-[rgb(var(--muted))]">
          Keep the timer rules and notification behavior close to the work, but make the controls easy to scan and update.
        </p>
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
        <div className="panel rounded-[28px] p-6 sm:p-7">
          <h2 className="text-xl font-semibold">Appearance and alerts</h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm">
              <span className="text-[rgb(var(--muted))]">Theme</span>
              <select
                value={settings.theme}
                onChange={onThemeChange}
                className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3"
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
                className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3"
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
        {error ? <p className="mt-3 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">Save failed: {error}</p> : null}
      </div>
        <div className="panel rounded-[28px] p-6 sm:p-7">
          <h2 className="text-xl font-semibold">Local Workspace</h2>
          <ul className="mt-4 grid gap-3 text-sm text-[rgb(var(--muted))]">
            <li>Data stays in the local file-backed store on this machine</li>
            <li>No sign-in, no cloud sync, and no account switching</li>
            <li>Project and session data persist across browser restarts</li>
            <li>CSV exports keep the same column shape as before</li>
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
        className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3"
      />
    </label>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-[22px] border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.18)] px-4 py-3">
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
