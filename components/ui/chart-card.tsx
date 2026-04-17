"use client";

export function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="panel rounded-[28px] p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-[rgb(var(--muted))]">{subtitle}</p>
      <div className="mt-4 h-[260px]">{children}</div>
    </div>
  );
}
