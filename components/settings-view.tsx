"use client";

import { FormEvent, useState } from "react";
import { alertVoiceModeSchema, themeSchema } from "@/lib/domain";
import { useSettings } from "@/lib/hooks";

const weekdayOptions = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

export function SettingsView() {
  const { settings, updateSettings, loading, error } = useSettings();
  const [notificationState, setNotificationState] = useState<string>("");
  type NumberFieldConfig = {
    key:
      | "billableTargetRate"
      | "billableRawToRoundedRate"
      | "rewardTargetRate";
    label: string;
    step?: string;
    min?: string;
    max?: string;
    value?: number;
    onChange: (value: string) => Promise<void>;
  };

  async function requestNotifications() {
    if (typeof Notification === "undefined") {
      setNotificationState("This browser does not support notifications.");
      return;
    }

    const permission = await Notification.requestPermission();
    await updateSettings({ notificationEnabled: permission === "granted" });
    setNotificationState(permission === "granted" ? "Notifications enabled." : "Notifications remain disabled.");
  }

  async function onNumberChange(
    key: "focusMinutes",
    value: string,
  ) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      await updateSettings({ [key]: parsed });
    }
  }

  async function onPercentChange(value: string) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      await updateSettings({ billableTargetRate: parsed / 100 });
    }
  }

  async function onRewardTargetChange(value: string) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      await updateSettings({ rewardTargetRate: parsed / 100 });
    }
  }

  async function onBillableConversionChange(value: string) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      await updateSettings({ billableRawToRoundedRate: parsed / 100 });
    }
  }

  async function onThemeChange(event: FormEvent<HTMLSelectElement>) {
    const parsed = themeSchema.safeParse(event.currentTarget.value);
    if (!parsed.success) {
      return;
    }
    await updateSettings({ theme: parsed.data });
  }

  async function onAlertVoiceModeChange(event: FormEvent<HTMLSelectElement>) {
    const parsed = alertVoiceModeSchema.safeParse(event.currentTarget.value);
    if (!parsed.success) {
      return;
    }
    await updateSettings({ alertVoiceMode: parsed.data });
  }

  if (loading) return <div>Loading settings...</div>;

  const targetFields: NumberFieldConfig[] = [
    { key: "billableTargetRate", label: "Billable target (%)", value: Math.round(settings.billableTargetRate * 100), min: "0", max: "100", step: "1", onChange: onPercentChange },
    {
      key: "billableRawToRoundedRate",
      label: "Raw-to-rounded billable (%)",
      value: Math.round(settings.billableRawToRoundedRate * 100),
      min: "1",
      max: "100",
      step: "1",
      onChange: onBillableConversionChange,
    },
  ] as const;
  const rewardFields: NumberFieldConfig[] = [
    {
      key: "rewardTargetRate",
      label: "Productivity target (%)",
      value: Math.round(settings.rewardTargetRate * 100),
      min: "1",
      max: "99",
      step: "1",
      onChange: onRewardTargetChange,
    },
  ] as const;

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
        </div>
        <div className="mt-8">
          <h2 className="text-xl font-semibold">Productivity targets</h2>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">
            These values combine with the billing schedule to drive today’s rounded billable target and raw focus estimate.
          </p>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            {targetFields.map((field) => (
              <NumberField
                key={field.key}
                label={field.label}
                value={field.value ?? settings[field.key]}
                min={field.min}
                max={field.max}
                step={field.step}
                onChange={field.onChange}
              />
            ))}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-[rgb(var(--muted))]">Billable week ends on</span>
              <select
                value={settings.billingWeekEndDay}
                onChange={(event) => updateSettings({ billingWeekEndDay: Number(event.currentTarget.value) })}
                className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3"
              >
                {weekdayOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-[rgb(var(--muted))]">Billable week cutoff time</span>
              <input
                type="time"
                value={settings.billingWeekEndTime}
                onChange={(event) => updateSettings({ billingWeekEndTime: event.currentTarget.value })}
                className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3"
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-[rgb(var(--muted))]">
            The billable progress card uses this cutoff; default is Friday at 18:00.
          </p>
        </div>
        <div className="mt-8 grid gap-4">
          <ToggleRow label="Focus rewards enabled" checked={settings.rewardEnabled} onChange={(checked) => updateSettings({ rewardEnabled: checked })} />
          <ToggleRow label="Auto-start focus" checked={settings.autoStartFocus} onChange={(checked) => updateSettings({ autoStartFocus: checked })} />
          <ToggleRow label="Sound enabled" checked={settings.soundEnabled} onChange={(checked) => updateSettings({ soundEnabled: checked })} />
        </div>
        <div className="mt-8">
          <h2 className="text-xl font-semibold">Focus rewards</h2>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">
            The productivity target drives the inferred free-minute balance.
          </p>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            {rewardFields.map((field) => (
              <NumberField
                key={field.key}
                label={field.label}
                value={field.value ?? settings[field.key]}
                min={field.min}
                max={field.max}
                step={field.step}
                onChange={field.onChange}
              />
            ))}
          </div>
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
            <label className="grid gap-2 text-sm">
              <span className="text-[rgb(var(--muted))]">Alert audio</span>
              <select
                value={settings.alertVoiceMode}
                onChange={onAlertVoiceModeChange}
                className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3"
              >
                <option value="chime-spoken">Chime + spoken</option>
                <option value="chime">Chime only</option>
                <option value="spoken">Spoken only</option>
                <option value="off">Off</option>
              </select>
            </label>
            <ToggleRow label="ntfy Coach notifications" checked={settings.ntfyEnabled} onChange={(checked) => updateSettings({ ntfyEnabled: checked })} />
            <label className="grid gap-2 text-sm">
              <span className="text-[rgb(var(--muted))]">ntfy server URL</span>
              <input
                type="url"
                value={settings.ntfyServerUrl}
                onChange={(event) => updateSettings({ ntfyServerUrl: event.currentTarget.value })}
                className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3"
                placeholder="https://ntfy.sh"
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-[rgb(var(--muted))]">ntfy topic</span>
              <input
                type="text"
                value={settings.ntfyTopic}
                onChange={(event) => updateSettings({ ntfyTopic: event.currentTarget.value })}
                className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3"
                placeholder="your-private-topic"
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-[rgb(var(--muted))]">ntfy priority</span>
              <select
                value={settings.ntfyPriority}
                onChange={(event) => updateSettings({ ntfyPriority: Number(event.currentTarget.value) })}
                className="rounded-2xl border border-[rgba(var(--line),0.45)] bg-[rgba(var(--bg),0.22)] px-4 py-3"
              >
                <option value={1}>1 - minimum</option>
                <option value={2}>2 - low</option>
                <option value={3}>3 - default</option>
                <option value={4}>4 - high</option>
                <option value={5}>5 - urgent</option>
              </select>
            </label>
          </div>
          <div className="mt-6 grid gap-4">
            <ToggleRow label="75% focus target alert" checked={settings.alertFocus75Enabled} onChange={(checked) => updateSettings({ alertFocus75Enabled: checked })} />
            <ToggleRow label="Raw focus target reached alert" checked={settings.alertRawFocusDoneEnabled} onChange={(checked) => updateSettings({ alertRawFocusDoneEnabled: checked })} />
            <ToggleRow label="Billable need reached alert" checked={settings.alertBillableNeedDoneEnabled} onChange={(checked) => updateSettings({ alertBillableNeedDoneEnabled: checked })} />
            <ToggleRow label="Finish-by slipping alert" checked={settings.alertFinishBySlippingEnabled} onChange={(checked) => updateSettings({ alertFinishBySlippingEnabled: checked })} />
            <ToggleRow label="Idle while work remains alert" checked={settings.alertIdleWhileWorkRemainsEnabled} onChange={(checked) => updateSettings({ alertIdleWhileWorkRemainsEnabled: checked })} />
            <ToggleRow label="Break recommended alert" checked={settings.alertBillableAheadBreakEnabled} onChange={(checked) => updateSettings({ alertBillableAheadBreakEnabled: checked })} />
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

function NumberField({
  label,
  value,
  min = "1",
  max,
  step = "1",
  onChange,
}: {
  label: string;
  value: number;
  min?: string;
  max?: string;
  step?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-[rgb(var(--muted))]">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
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
