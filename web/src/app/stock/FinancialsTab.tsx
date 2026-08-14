"use client";

import { useEffect, useState } from "react";
import {
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { financialsFor } from "./data";

Chart.register(BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

// Chart colors come from the live .stk CSS variables (fixed glass palette,
// one read on mount). Null until mounted — no document during SSR.
function useStkVars() {
  const [vars, setVars] = useState<{ brand: string; up: string; dn: string; amber: string; text2: string; text3: string; border: string } | null>(null);
  useEffect(() => {
    const s = getComputedStyle(document.querySelector(".stk") ?? document.documentElement);
    const v = (n: string) => s.getPropertyValue(n).trim();
    setVars({ brand: v("--brand"), up: v("--up"), dn: v("--dn"), amber: v("--amber"), text2: v("--text-2"), text3: v("--text-3"), border: v("--border") });
  }, []);
  return vars;
}

const legendOpts = (color: string) => ({
  position: "bottom" as const,
  labels: { boxWidth: 12, usePointStyle: true, font: { size: 12 }, color },
});

export function FinancialsTab({ ticker }: { ticker: string }) {
  const vars = useStkVars();
  if (!vars) return null;
  const f = financialsFor(ticker);
  const axis = {
    x: { grid: { display: false }, ticks: { color: vars.text3, font: { size: 11 } } },
    y: { grid: { color: vars.border }, ticks: { color: vars.text3, font: { size: 11 }, callback: (v: unknown) => "$" + v + "B" } },
  };
  const pctAxis = {
    x: axis.x,
    y: { grid: { color: vars.border }, ticks: { color: vars.text3, font: { size: 11 }, callback: (v: unknown) => v + "%" } },
  };
  return (
    <>
      <div className="card card-pad">
        <h2>Key ratios</h2>
        <div className="ratio-grid">
          {f.ratios.map((r) => (
            <div className="ratio-item" key={r.label}>
              <span className="k">{r.label}</span>
              <span className="v">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="cards2">
        <div className="card card-pad">
          <h2>Income statement</h2>
          <div className="chart-box">
            <Bar
              data={{
                labels: f.years,
                datasets: [
                  { label: "Revenue", data: f.revenue, backgroundColor: vars.brand, borderRadius: 4 },
                  { label: "Net income", data: f.netIncome, backgroundColor: vars.up, borderRadius: 4 },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: legendOpts(vars.text2), tooltip: { callbacks: { label: (c) => `${c.dataset.label}: $${c.parsed.y}B` } } },
                scales: axis,
              }}
            />
          </div>
        </div>
        <div className="card card-pad">
          <h2>Margins</h2>
          <div className="chart-box">
            <Line
              data={{
                labels: f.years,
                datasets: [
                  { label: "Gross margin", data: f.grossMargin, borderColor: vars.brand, fill: false, tension: 0.3, pointRadius: 3, pointBackgroundColor: vars.brand, borderWidth: 2 },
                  { label: "Net margin", data: f.netMargin, borderColor: vars.up, fill: false, tension: 0.3, pointRadius: 3, pointBackgroundColor: vars.up, borderWidth: 2 },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: legendOpts(vars.text2), tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y}%` } } },
                scales: pctAxis,
              }}
            />
          </div>
        </div>
        <div className="card card-pad">
          <h2>Cash flow</h2>
          <div className="chart-box">
            <Bar
              data={{
                labels: f.years,
                datasets: [
                  { label: "Operating cash flow", data: f.ocf, backgroundColor: vars.amber, borderRadius: 4 },
                  { label: "Free cash flow", data: f.fcf, backgroundColor: vars.up, borderRadius: 4 },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: legendOpts(vars.text2), tooltip: { callbacks: { label: (c) => `${c.dataset.label}: $${c.parsed.y}B` } } },
                scales: axis,
              }}
            />
          </div>
        </div>
        <div className="card card-pad">
          <h2>Balance sheet <span className="muted">latest FY</span></h2>
          {f.balance.map((b) => (
            <div className="bal-row" key={b.label}>
              <span className="k">{b.label}</span>
              <span className="v">{b.value}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
