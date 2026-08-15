"use client";

import { useEffect, useState } from "react";
import { CategoryScale, Chart, Filler, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";
import { FEATURED_RANGES, type Featured, type FeaturedRange, type RangeSeries } from "./data";

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

function FeaturedChart({ range, series }: { range: FeaturedRange; series: RangeSeries }) {
  const vars = useBriefVars();
  if (!vars) return null;
  const { labels, points } = series;
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

export function FeaturedCard({ featured }: { featured: Featured }) {
  const [range, setRange] = useState<FeaturedRange>("1D");
  const ah = featured.afterHours;
  const up = featured.change >= 0;
  return (
    <section className="fc">
      <div className="fc-name">
        {featured.name} ({featured.ticker})
      </div>
      <div className="fc-top">
        <div>
          <div className="fc-price">${featured.price.toFixed(2)}</div>
          <div className={"fc-chg " + (up ? "t-up" : "t-dn")}>
            {up ? "+" : "-"}${Math.abs(featured.change).toFixed(2)} ({up ? "+" : ""}
            {featured.changePct.toFixed(2)}%)<span className="asof">{featured.asOf}</span>
          </div>
          {ah && (
            <div className="fc-ah">
              ${ah.price.toFixed(2)}{" "}
              <span className={ah.change >= 0 ? "t-up" : "t-dn"}>
                {ah.change >= 0 ? "+" : "-"}${Math.abs(ah.change).toFixed(2)} ({ah.changePct.toFixed(2)}%)
              </span>{" "}
              After Hours
            </div>
          )}
        </div>
        <div className="fc-ranges">
          {FEATURED_RANGES.map((r) => (
            <button key={r} className={r === range ? "on" : ""} aria-pressed={r === range} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="fc-chart">
        <FeaturedChart range={range} series={featured.series[range]} />
      </div>
      <div className="fc-stats">
        {featured.stats.map((s) => (
          <div className="fc-stat" key={s.label}>
            <span>{s.label}</span>
            <b>{s.value}</b>
          </div>
        ))}
      </div>
    </section>
  );
}
