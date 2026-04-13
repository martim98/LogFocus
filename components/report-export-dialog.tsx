"use client";

import { useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { buildPomofocusReportCsv, downloadReportCsv, ReportDelimiter, ReportTimeFormat } from "@/lib/report-export";
import { cn, getDateKey } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ReportExportDialog({ open, onClose }: Props) {
  const sessions = useAppStore((state) => state.sessions);
  const projects = useAppStore((state) => state.projects);
  const tasks = useAppStore((state) => state.tasks);
  const [startDate, setStartDate] = useState(getDateKey(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)));
  const [endDate, setEndDate] = useState(getDateKey());
  const [includeTask, setIncludeTask] = useState(true);
  const [delimiter, setDelimiter] = useState<ReportDelimiter>("comma");
  const [timeFormat, setTimeFormat] = useState<ReportTimeFormat>("hours");

  const previewCount = useMemo(
    () =>
      sessions.filter(
        (session) => session.completed && session.mode === "focus" && session.startedAt >= `${startDate}T00:00:00` && session.startedAt <= `${endDate}T23:59:59.999`,
      ).length,
    [endDate, sessions, startDate],
  );

  if (!open) {
    return null;
  }

  function handleDownload() {
    const csv = buildPomofocusReportCsv(sessions, projects, tasks, {
      startDate,
      endDate,
      includeTask,
      delimiter,
      timeFormat,
    });
    downloadReportCsv(`report-${startDate}-to-${endDate}.csv`, csv);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] border border-[rgb(var(--line))] bg-[rgb(var(--panel))] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[rgb(var(--line))] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Download Report</h2>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">Export Pomofocus-style CSV with the same column schema.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-[rgb(var(--muted))] hover:bg-black/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6">
          <Field label="From / To">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr]">
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.currentTarget.value)} className={inputClassName} />
              <div className="hidden items-center justify-center text-[rgb(var(--muted))] sm:flex">-</div>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.currentTarget.value)} className={inputClassName} />
            </div>
          </Field>

          <Field label="Column">
            <label className="flex items-center gap-3 text-base">
              <input type="checkbox" checked={includeTask} onChange={(event) => setIncludeTask(event.currentTarget.checked)} className="h-5 w-5" />
              Include Task
            </label>
          </Field>

          <Field label="Focus Time">
            <div className="flex flex-wrap gap-4">
              <RadioOption checked={timeFormat === "minutes"} onClick={() => setTimeFormat("minutes")} label="Minutes" />
              <RadioOption checked={timeFormat === "hours"} onClick={() => setTimeFormat("hours")} label="Hours" />
            </div>
          </Field>

          <Field label="Delimiter">
            <div className="flex flex-wrap gap-4">
              <RadioOption checked={delimiter === "tab"} onClick={() => setDelimiter("tab")} label="Tab" />
              <RadioOption checked={delimiter === "comma"} onClick={() => setDelimiter("comma")} label="Comma" />
            </div>
          </Field>

          <div className="flex items-center justify-between rounded-[20px] bg-black/5 px-4 py-3 text-sm text-[rgb(var(--muted))]">
            <span>{previewCount} completed focus session{previewCount === 1 ? "" : "s"} in range</span>
            <span>{delimiter === "comma" ? "Comma-separated" : "Tab-separated"}</span>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-[rgb(var(--bg))] px-5 py-4 text-base font-semibold text-white transition hover:opacity-90"
          >
            <Download className="h-5 w-5" />
            Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3">
      <p className="text-lg font-semibold text-[rgb(var(--muted))]">{label}</p>
      {children}
    </div>
  );
}

function RadioOption({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-3 rounded-full border px-4 py-2 text-base transition",
        checked ? "border-[rgb(var(--bg))] bg-[rgb(var(--bg))] text-white" : "border-[rgb(var(--line))] bg-white text-[rgb(var(--bg))]",
      )}
    >
      <span className={cn("h-4 w-4 rounded-full border", checked ? "border-white bg-white" : "border-[rgb(var(--line))] bg-white")} />
      {label}
    </button>
  );
}

const inputClassName =
  "w-full rounded-[18px] border border-[rgb(var(--line))] bg-white px-4 py-3 text-base text-[rgb(var(--bg))] outline-none transition focus:border-[rgb(var(--bg))]";
