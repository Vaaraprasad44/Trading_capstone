"use client";

import { useEffect, useState } from "react";
import {
  Chart,
  ArcElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import { COLORS, series, type ClosedTrade, type ComputedHolding } from "./data";

Chart.register(ArcElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

type CssVars = { brand: string; text2: string; text3: string; border: string; up: string; dn: string; amber: string };

// Chart colors come from the live CSS variables so they follow the theme.
// themeTick bumps on toggle → re-read. Null until mounted (no document in SSR).
// Read from .dash (not the root): the dashboard overrides the palette locally
// to blend everything into the space background.
function useCssVars(themeTick: number): CssVars | null {
  const [vars, setVars] = useState<CssVars | null>(null);
  useEffect(() => {
    const s = getComputedStyle(document.querySelector(".dash") ?? document.documentElement);
    const v = (n: string) => s.getPropertyValue(n).trim();
    setVars({
      brand: v("--brand"), text2: v("--text-2"), text3: v("--text-3"),
      border: v("--border"), up: v("--up"), dn: v("--dn"), amber: v("--amber"),
    });
  }, [themeTick]);
  return vars;
}

const noAxes = { x: { display: false as const }, y: { display: false as const } };

export function PerfChart({ range, themeTick }: { range: "1M" | "3M" | "6M" | "1Y"; themeTick: number }) {
  const vars = useCssVars(themeTick);
  if (!vars) return null;
  const ranges = {
    "1M": series(22, 1180000, 0.006, 0.0016),
    "3M": series(30, 1120000, 0.008, 0.0017),
    "6M": series(30, 1000000, 0.01, 0.002),
    "1Y": series(40, 820000, 0.012, 0.0028),
  };
  const bench = {
    "1M": series(22, 1185000, 0.005, 0.0009),
    "3M": series(30, 1140000, 0.006, 0.001),
    "6M": series(30, 1000000, 0.007, 0.0011),
    "1Y": series(40, 860000, 0.009, 0.0015),
  };
  const d = ranges[range];
  return (
    <Line
      data={{
        labels: d.map(() => ""),
        datasets: [
          { label: "Portfolio", data: d, borderColor: vars.brand, backgroundColor: "rgba(78,79,235,.08)", fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2.5 },
          { label: "S&P 500", data: bench[range], borderColor: vars.text3, borderDash: [5, 4], fill: false, tension: 0.35, pointRadius: 0, borderWidth: 1.5 },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "bottom", labels: { boxWidth: 12, usePointStyle: true, font: { size: 12 }, color: vars.text2 } },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: $${(c.parsed.y ?? 0).toLocaleString()}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { display: false } },
          y: { grid: { color: vars.border }, ticks: { color: vars.text3, font: { size: 11 }, callback: (v) => "$" + (Number(v) / 1000000).toFixed(2) + "M" } },
        },
      }}
    />
  );
}

export function AllocDonut({ holdings, themeTick }: { holdings: ComputedHolding[]; themeTick: number }) {
  const vars = useCssVars(themeTick);
  if (!vars) return null;
  return (
    <Doughnut
      data={{
        labels: holdings.map((h) => h.ticker),
        datasets: [{ data: holdings.map((h) => h.allocation), backgroundColor: holdings.map((_, i) => COLORS[i % COLORS.length]), borderWidth: 0 }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout: "66%",
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => `${c.label}: ${(c.parsed as number).toFixed(2)}%` } },
        },
      }}
    />
  );
}

export function SipChart({ months, monthly, themeTick }: { months: number; monthly: number; themeTick: number }) {
  const vars = useCssVars(themeTick);
  if (!vars) return null;
  const labels: string[] = [];
  const inv: number[] = [];
  const val: number[] = [];
  let v = 0;
  for (let i = 1; i <= months; i++) {
    v = (v + monthly) * (1 + 0.012 + Math.sin(i * 0.7) * 0.01);
    labels.push("M" + i);
    inv.push(monthly * i);
    val.push(Math.round(v));
  }
  return (
    <Line
      data={{
        labels,
        datasets: [
          { label: "Current value", data: val, borderColor: vars.up, backgroundColor: "rgba(24,158,106,.10)", fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2.5 },
          { label: "Invested", data: inv, borderColor: vars.text3, borderDash: [5, 4], stepped: true, fill: false, pointRadius: 0, borderWidth: 1.5 },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, usePointStyle: true, font: { size: 12 }, color: vars.text2 } },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: $${(c.parsed.y ?? 0).toLocaleString()}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: vars.text3, font: { size: 10 }, maxTicksLimit: 8 } },
          y: { grid: { color: vars.border }, ticks: { color: vars.text3, font: { size: 11 }, callback: (v) => "$" + (Number(v) / 1000).toFixed(0) + "k" } },
        },
      }}
    />
  );
}

export function EquityChart({ closed, themeTick }: { closed: ClosedTrade[]; themeTick: number }) {
  const vars = useCssVars(themeTick);
  if (!vars) return null;
  const eq: number[] = [];
  let run = 0;
  [...closed].reverse().forEach((t) => {
    run += t.pnl;
    eq.push(Math.round(run));
  });
  return (
    <Line
      data={{
        labels: eq.map((_, i) => "T" + (i + 1)),
        datasets: [{ label: "Cumulative realized P&L", data: eq, borderColor: vars.amber, backgroundColor: "rgba(232,145,28,.10)", fill: true, tension: 0.25, pointRadius: 3, pointBackgroundColor: vars.amber, borderWidth: 2.5 }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => `Cumulative: $${(c.parsed.y ?? 0).toLocaleString()}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: vars.text3, font: { size: 10 } } },
          y: { grid: { color: vars.border }, ticks: { color: vars.text3, font: { size: 11 }, callback: (v) => "$" + (Number(v) / 1000).toFixed(0) + "k" } },
        },
      }}
    />
  );
}

export function SparkChart({ price, up, themeTick }: { price: number; up: boolean; themeTick: number }) {
  const vars = useCssVars(themeTick);
  if (!vars) return null;
  const data = series(30, price * 0.85, 0.02, 0.006);
  return (
    <Line
      data={{
        labels: data.map(() => ""),
        datasets: [{ data, borderColor: up ? vars.up : vars.dn, backgroundColor: up ? "rgba(24,158,106,.10)" : "rgba(224,65,58,.10)", fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 }],
      }}
      options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: noAxes }}
    />
  );
}
