"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AgGridReact } from "ag-grid-react";
import { STOCK_TABS } from "@/app/stock/data";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
  type IsFullWidthRowParams,
  type PostSortRowsParams,
  type RowHeightParams,
} from "ag-grid-community";
import { infoFor, pct, usd, usd2, type ComputedHolding } from "./data";

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

// __detail rows are synthetic copies of their parent holding rendered as
// full-width key-metric panels (Community stand-in for Enterprise
// master/detail). Copying the parent's fields keeps sorting and the quick
// filter behaving identically for both rows.
type GridRow = ComputedHolding & { history: number[]; __detail?: boolean };

type GridCtx = {
  openMenu: (ticker: string, rect: DOMRect) => void;
  collapse: () => void;
};

const HISTORY_LEN = 40;
const DETAIL_ROW_H = 162;

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

// Kebab: keeps drawer access now that row clicks toggle the inline metrics.
// Raw <button> is the AG Grid cell-renderer exception (no DOM library
// components inside grid cells). The row-click handler ignores clicks
// originating here (AG Grid's own row listener fires before React's, so
// stopPropagation alone can't cover it).
function KebabCell(p: ICellRendererParams<GridRow>) {
  return (
    <button
      className="kebab-btn"
      title="More actions"
      aria-label={`Actions for ${p.data?.ticker}`}
      aria-haspopup="menu"
      onClick={(e) => {
        e.stopPropagation();
        (p.context as GridCtx).openMenu(p.data!.ticker, e.currentTarget.getBoundingClientRect());
      }}
    >
      ⋮
    </button>
  );
}

// Full-width key-metrics panel (Screener-style 3×3 grid) rendered under the
// clicked holding. Current Price is the live drifting LTP; the rest comes
// from the same mock StockInfo that feeds the drawer.
function MetricsRow(p: ICellRendererParams<GridRow>) {
  const d = p.data!;
  const info = infoFor(d.ticker);
  const dollar = (v: string) => (v === "—" ? v : "$" + v);
  const cells: { k: string; v: string; cls?: string }[] = [
    { k: "Market Cap", v: dollar(info.mcap) },
    { k: "Current Price", v: usd2(d.ltp), cls: d.day >= 0 ? "t-up" : "t-dn" },
    { k: "High / Low", v: info.hi === "—" ? "—" : `$${info.hi} / ${info.lo}` },
    { k: "Stock P/E", v: info.pe },
    { k: "EPS (TTM)", v: dollar(info.eps) },
    { k: "Div Yield", v: info.div },
    { k: "ROCE", v: info.roce },
    { k: "ROE", v: info.roe },
    { k: "Beta", v: info.beta },
  ];
  return (
    <div className="mp" onClick={() => (p.context as GridCtx).collapse()}>
      <div className="mp-head">
        <b>{d.ticker}</b> Key metrics
        <span className="mp-src">via market-data MCP</span>
        <button
          className="mp-hint"
          onClick={(e) => {
            e.stopPropagation();
            (p.context as GridCtx).collapse();
          }}
        >
          collapse ✕
        </button>
      </div>
      <div className="mp-grid">
        {cells.map((c) => (
          <div className="mp-cell" key={c.k}>
            <span className="k">{c.k}</span>
            <span className={"v " + (c.cls ?? "")}>{c.v}</span>
          </div>
        ))}
      </div>
    </div>
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

const KEBAB_COL: ColDef<GridRow> = {
  colId: "actions",
  headerName: "Actions", // visually hidden via .kebab-head, kept for screen readers
  headerClass: "kebab-head",
  cellRenderer: KebabCell,
  cellClass: "kebab-cell",
  width: 60,
  minWidth: 60,
  maxWidth: 60,
  flex: 0,
  sortable: false,
  resizable: false,
};

const DEFAULT_COL: ColDef<GridRow> = {
  sortable: true,
  resizable: true,
  unSortIcon: true, // show up/down arrows on unsorted columns too
  flex: 1,
  minWidth: 90,
};

export function HoldingsGrid({ holdings, filter, onOpen, detail = false, onAsk }: {

  holdings: ComputedHolding[];
  filter: string;
  onOpen: (ticker: string) => void;
  /** row click expands inline key metrics (accordion) + adds the ⋮ column */
  detail?: boolean;
  onAsk?: (q: string) => void;
}) {
  // Rolling LTP history per ticker, fed by the same drift ticks that update
  // the table. New tickers get a synthetic backfill so sparklines start full.
  const historyRef = useRef(new Map<string, number[]>());
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ ticker: string; top: number; left: number } | null>(null);

  const rows = useMemo<GridRow[]>(() => {
    const hist = historyRef.current;
    const out: GridRow[] = holdings.map((h) => {
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
    if (detail && expanded) {
      const i = out.findIndex((r) => r.ticker === expanded);
      if (i >= 0) out.splice(i + 1, 0, { ...out[i], __detail: true });
    }
    return out;
  }, [holdings, detail, expanded]);

  const openMenu = useCallback((ticker: string, rect: DOMRect) => {
    const MENU_W = 210;
    const MENU_H = 196; // 4 page links + separator + Ask AI
    // flip above the trigger when there's no room below
    const top = rect.bottom + MENU_H + 6 > window.innerHeight ? rect.top - MENU_H - 6 : rect.bottom + 6;
    setMenu({ ticker, top, left: Math.min(rect.left, window.innerWidth - MENU_W - 12) });
  }, [setMenu]);
  const collapse = useCallback(() => setExpanded(null), [setExpanded]);
  const ctx = useMemo<GridCtx>(() => ({ openMenu, collapse }), [openMenu, collapse]);

  // dropdown dismissal: outside click, Esc, scroll or resize (the menu is
  // fixed-positioned, so scrolling would detach it from its row)
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".kebab-menu")) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    const dismiss = () => setMenu(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [menu]);

  // Esc also collapses the expanded metrics row (unless a menu is open —
  // then Esc is consumed by the menu dismissal above)
  useEffect(() => {
    if (!expanded || menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded, menu]);

  const isFullWidthRow = useCallback((p: IsFullWidthRowParams<GridRow>) => !!p.rowNode.data?.__detail, []);
  const getRowHeight = useCallback(
    (p: RowHeightParams<GridRow>) => (p.data?.__detail ? DETAIL_ROW_H : undefined),
    [],
  );

  // Sorting orders the detail row independently of its parent (it's a normal
  // row to the row model), so re-seat it directly below the parent after
  // every sort.
  const postSortRows = useCallback((params: PostSortRowsParams<GridRow>) => {
    const nodes = params.nodes;
    const di = nodes.findIndex((n) => n.data?.__detail);
    if (di < 0) return;
    const [dn] = nodes.splice(di, 1);
    const pi = nodes.findIndex((n) => n.data?.ticker === dn.data?.ticker);
    nodes.splice(pi < 0 ? di : pi + 1, 0, dn);
  }, []);

  const colDefs = useMemo(() => (detail ? [...COL_DEFS, KEBAB_COL] : COL_DEFS), [detail]);

  return (
    <div className="holdings-grid">
      <AgGridReact<GridRow>
        theme={glassTheme}
        rowData={rows}
        columnDefs={colDefs}
        defaultColDef={DEFAULT_COL}
        getRowId={(p) => p.data.ticker + p.data.name + (p.data.__detail ? ":detail" : "")}
        quickFilterText={filter}
        domLayout="autoHeight"
        rowHeight={40}
        context={ctx}
        isFullWidthRow={isFullWidthRow}
        fullWidthCellRenderer={MetricsRow}
        getRowHeight={getRowHeight}
        postSortRows={postSortRows}
        onRowClicked={(e) => {
          if (!e.data || e.data.__detail) return; // panel handles its own collapse
          const tgt = e.event?.target as HTMLElement | null;
          if (tgt?.closest(".kebab-btn")) return; // kebab opens the menu instead
          if (!detail) {
            onOpen(e.data.ticker);
            return;
          }
          const t = e.data.ticker;
          setExpanded((cur) => (cur === t ? null : t));
        }}
        suppressCellFocus
      />
      {/* Portaled out of the .card: its backdrop-filter makes the card the
          containing block for position:fixed, which displaced the menu.
          Target .dash (no filter/transform) so the glass tokens still apply. */}
      {menu &&
        createPortal(
          <div className="kebab-menu" style={{ top: menu.top, left: menu.left }} role="menu">
            {STOCK_TABS.map((t, i) => (
              <button
                key={t.tab}
                role="menuitem"
                autoFocus={i === 0}
                onClick={() => {
                  setMenu(null);
                  router.push(`/stock/${menu.ticker}/${t.tab}`);
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
            {onAsk && (
              <>
                <div className="kebab-sep" />
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenu(null);
                    onAsk(`Tell me more about ${menu.ticker} — should I be worried about my position?`);
                  }}
                >
                  ✦ Ask AI about {menu.ticker}
                </button>
              </>
            )}
          </div>,
          document.querySelector(".dash") ?? document.body,
        )}
    </div>
  );
}
