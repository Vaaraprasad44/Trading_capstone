"use client";

import { useState } from "react";
import Link from "next/link";
import { FEATURED_RANGES, briefing, featured, type BriefingSection, type FeaturedRange } from "./data";
import { FeaturedChart } from "./FeaturedChart";
import "./briefing.css";

/* markdown-lite: the briefing agent emits **bold** inside sentences */
function Inline({ text }: { text: string }) {
  return <>{text.split("**").map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))}</>;
}

function Sources({ names }: { names?: string[] }) {
  if (!names?.length) return null;
  return (
    <div className="src-row">
      {names.map((n) => (
        <span className="src" key={n}>
          {n}
        </span>
      ))}
    </div>
  );
}

function FeaturedCard() {
  const [range, setRange] = useState<FeaturedRange>("1D");
  const ah = featured.afterHours;
  return (
    <section className="fc">
      <div className="fc-name">
        {featured.name} ({featured.ticker})
      </div>
      <div className="fc-top">
        <div>
          <div className="fc-price">${featured.price.toFixed(2)}</div>
          <div className="fc-chg t-up">
            +${featured.change.toFixed(2)} (+{featured.changePct.toFixed(2)}%)<span className="asof">{featured.asOf}</span>
          </div>
          <div className="fc-ah">
            ${ah.price.toFixed(2)}{" "}
            <span className="t-dn">
              -${Math.abs(ah.change).toFixed(2)} ({ah.changePct.toFixed(2)}%)
            </span>{" "}
            After Hours
          </div>
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
        <FeaturedChart range={range} />
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

function Section({ n, s }: { n: number; s: BriefingSection }) {
  return (
    <section>
      <h2>
        {n}. {s.title}
      </h2>
      {s.paragraphs.map((p, i) => (
        <p key={i}>
          <Inline text={p} />
        </p>
      ))}
      {s.whyItMatters && (
        <p>
          <b>Why it matters:</b> <Inline text={s.whyItMatters} />
        </p>
      )}
      {s.whatNext && (
        <p>
          <b>What matters next:</b> <Inline text={s.whatNext} />
        </p>
      )}
      <Sources names={s.sources} />
    </section>
  );
}

export default function BriefingPage() {
  return (
    <div className="brief">
      <nav className="nav">
        <div className="wrap nav-inner">
          <Link className="logo" href="/">
            <div className="logo-mark">M</div> Meridian Capital
          </Link>
          <div className="nav-right">
            <Link className="back-link" href="/dashboard">
              ← Dashboard
            </Link>
            <div className="avatar">PR</div>
          </div>
        </div>
      </nav>

      <article className="article">
        <div className="crumb">
          AI Market Briefing <span>›</span>
          <span className="status-pill">{briefing.marketStatus}</span>
        </div>
        <h1>AI + Markets Daily Briefing — {briefing.date}</h1>
        <p>
          <b>Market pulse:</b> <Inline text={briefing.pulse} />
        </p>
        <Sources names={briefing.pulseSources} />

        <FeaturedCard />

        {briefing.sections.map((s, i) => (
          <Section key={s.title} n={i + 1} s={s} />
        ))}

        <div className="bottom">
          <h2>Bottom line</h2>
          <p>
            <Inline text={briefing.bottomLine} />
          </p>
        </div>

        <div className="foot">
          Placeholder content — this page will be generated each morning by the ai-markets-briefing headless agent
          before the market opens.
        </div>
      </article>
    </div>
  );
}
