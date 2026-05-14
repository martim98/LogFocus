"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type TimelinePoint = {
  date?: string;
  label?: string;
  minutes?: number;
  sessions?: number;
  productivityScore?: number;
};

export function FocusMinutesAreaChart({ data }: { data: TimelinePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="minutesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="rgb(var(--accent-strong))" stopOpacity={0.45} />
            <stop offset="95%" stopColor="rgb(var(--accent-strong))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(var(--line),0.8)" vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <Tooltip />
        <Area type="monotone" dataKey="minutes" stroke="rgb(var(--accent-strong))" fill="url(#minutesGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SessionCountBarChart({ data }: { data: TimelinePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid stroke="rgba(var(--line),0.8)" vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <Tooltip />
        <Bar dataKey="sessions" fill="rgb(var(--accent-alt))" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProductivityScoreLineChart({ data }: { data: TimelinePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid stroke="rgba(var(--line),0.8)" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} domain={[0, 100]} />
        <Tooltip
          formatter={(value) => [`${Math.round(Number(value ?? 0))}%`, "Score"]}
          labelFormatter={(label) => `Day ${label}`}
        />
        <Line type="monotone" dataKey="productivityScore" stroke="rgb(var(--accent-strong))" strokeWidth={3} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
