"use client";

import { useEffect, useState } from "react";
import { CategoryScale, Chart, Filler, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";
import { featuredSeries, type FeaturedRange } from "./data";

Chart.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler);

// Chart colors come from the live .brief CSS variables (the page pins the
// glass palette, so one read on mount is enough). Null until mounted — no
// document during SSR.
function useBriefVars() {
  const [vars, setVars] = useState<{ up: string; dn: string; text3: string; border: string } | null>(null);
  useEffect(() => {
    const s = getComputedStyle(document.querySelector(".brief") ?? document.documentElement);
    const v = (n: string) => s.getPropertyValue(n).trim();
    setVars({ up: v("--up"), dn: v("--dn"), text3: v("--text-3"), border: v("--border") });
  }, []);
  return vars;
}

export function FeaturedChart({ range }: { range: FeaturedRange }) {
  const vars = useBriefVars();
  if (!vars) return null;
  const { labels, points } = featuredSeries(range);
  const up = points[points.length - 1] >= points[0];
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            data: points,
            borderColor: up ? vars.up : vars.dn,
            backgroundColor: up ? "rgba(0, 230, 148, 0.10)" : "rgba(255, 91, 110, 0.10)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { intersect: false, mode: "index", callbacks: { label: (c) => `$${(c.parsed.y ?? 0).toFixed(2)}` } },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { display: range === "1D", color: vars.text3, font: { size: 10 }, maxTicksLimit: 7, maxRotation: 0 },
          },
          y: {
            grid: { color: vars.border },
            ticks: { color: vars.text3, font: { size: 11 }, maxTicksLimit: 5, callback: (v) => Number(v).toFixed(0) },
          },
        },
      }}
    />
  );
}
