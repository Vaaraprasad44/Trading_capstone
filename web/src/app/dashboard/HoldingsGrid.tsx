"use client";

import { useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { pct, usd, usd2, type ComputedHolding } from "./data";

ModuleRegistry.registerModules([AllCommunityModule]);

// AG Grid Community port of the ag-grid finance demo's table, themed to the
// dashboard's glass look via the Theming API (no CSS files needed). The
// sparkline timeline column is hand-rolled SVG — the demo's native sparklines
// are an Enterprise feature.
const glassTheme = themeQuartz.withParams({
  backgroundColor: "transparent",
  foregroundColor: "#f2f4f8",
  headerBackgroundColor: "rgba(232, 234, 242, 0.05)",
  headerTextColor: "rgba(232, 234, 242, 0.78)",
  borderColor: "rgba(232, 234, 242, 0.1)",
  rowHoverColor: "rgba(232, 234, 242, 0.06)",
  accentColor: "#2962ff",
  fontFamily: "inherit",
  fontSize: 13,
  headerFontSize: 13.5,
  headerFontWeight: 600,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  cellHorizontalPadding: 14,
  rowVerticalPaddingScale: 0.9,
});

type GridRow = ComputedHolding & { history: number[] };

const HISTORY_LEN = 40;

function gauss() {
  return Math.random() + Math.random() + Math.random() - 1.5;
}

function TickerCell(p: ICellRendererParams<GridRow, string>) {
  return (
    <span className="tkr">
      {p.value} <span className="chev">›</span>
    </span>
  );
}

// Line sparkline of recent LTP ticks, colored by direction over the window —
// stands in for the finance demo's Enterprise sparkline column.
function TimelineCell(p: ICellRendererParams<GridRow>) {
  const h = p.data?.history;
  if (!h || h.length < 2) return null;
  const w = 120;
  const ht = 26;
  const pad = 2;
  const min = Math.min(...h);
  const max = Math.max(...h);
  const span = max - min || 1;
  const pts = h
    .map((v, i) => {
      const x = pad + (i / (h.length - 1)) * (w - pad * 2);
      const y = ht - pad - ((v - min) / span) * (ht - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = h[h.length - 1] >= h[0];
  const color = up ? "#00e694" : "#ff5b6e";
  const [lx, ly] = pts.split(" ").pop()!.split(",");
  return (
    <svg width={w} height={ht} style={{ display: "block", margin: "6px 0" }} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2" fill={color} />
    </svg>
  );
}

const numCol = (field: keyof ComputedHolding, headerName: string, fmt: (v: number) => string): ColDef<GridRow> => ({
  field,
  headerName,
  type: "rightAligned",
  filter: "agNumberColumnFilter",
  valueFormatter: (p) => (p.value == null ? "" : fmt(p.value as number)),
});

const trendClass = (p: { value: number | null | undefined }) =>
  p.value == null ? "" : p.value >= 0 ? "t-up" : "t-dn";

const COL_DEFS: ColDef<GridRow>[] = [
  { field: "ticker", headerName: "Ticker", cellRenderer: TickerCell, width: 120, filter: true },
  { field: "name", headerName: "Name", flex: 2, minWidth: 170, filter: true },
  {
    colId: "timeline",
    headerName: "Timeline",
    cellRenderer: TimelineCell,
    sortable: false,
    width: 150,
  },
  { ...numCol("qty", "Qty", (v) => v.toFixed(2)) },
  { ...numCol("avg", "Avg buy", usd2) },
  { ...numCol("ltp", "LTP", usd2), enableCellChangeFlash: true },
  { ...numCol("buyValue", "Buy value", usd) },
  { ...numCol("presentValue", "Present value", usd), enableCellChangeFlash: true },
  { ...numCol("pnlPct", "P&L %", pct), cellClass: trendClass, enableCellChangeFlash: true, sort: "desc" },
  { ...numCol("allocation", "Alloc %", (v) => v.toFixed(2) + "%") },
  { ...numCol("day", "Day %", pct), cellClass: trendClass },
];

const DEFAULT_COL: ColDef<GridRow> = {
  sortable: true,
  resizable: true,
  unSortIcon: true, // show up/down arrows on unsorted columns too
  flex: 1,
  minWidth: 90,
};

export function HoldingsGrid({ holdings, filter, onOpen }: {
  holdings: ComputedHolding[];
  filter: string;
  onOpen: (ticker: string) => void;
}) {
  // Rolling LTP history per ticker, fed by the same drift ticks that update
  // the table. New tickers get a synthetic backfill so sparklines start full.
  const historyRef = useRef(new Map<string, number[]>());

  const rows = useMemo<GridRow[]>(() => {
    const hist = historyRef.current;
    return holdings.map((h) => {
      let arr = hist.get(h.ticker);
      if (!arr) {
        arr = [];
        let v = h.ltp;
        for (let i = 0; i < HISTORY_LEN - 1; i++) {
          v = Math.max(1, v * (1 - gauss() * 0.004));
          arr.unshift(v);
        }
        hist.set(h.ticker, arr);
      }
      arr.push(h.ltp);
      if (arr.length > HISTORY_LEN) arr.shift();
      return { ...h, history: [...arr] };
    });
  }, [holdings]);

  return (
    <div className="holdings-grid">
      <AgGridReact<GridRow>
        theme={glassTheme}
        rowData={rows}
        columnDefs={COL_DEFS}
        defaultColDef={DEFAULT_COL}
        getRowId={(p) => p.data.ticker + p.data.name}
        quickFilterText={filter}
        domLayout="autoHeight"
        rowHeight={40}
        onRowClicked={(e) => e.data && onOpen(e.data.ticker)}
        suppressCellFocus
      />
    </div>
  );
}
