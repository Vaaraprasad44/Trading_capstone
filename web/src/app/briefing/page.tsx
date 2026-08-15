import Link from "next/link";
import { getBriefing, type BriefingSection } from "./data";
import { FeaturedCard } from "./FeaturedChart";
import "./briefing.css";

/* markdown-lite: the briefing generator emits **bold** inside sentences */
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

export default async function BriefingPage() {
  const briefing = await getBriefing();
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

        <FeaturedCard featured={briefing.featured} />

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
          Generated each morning before market open by the ai-markets-briefing workflow — prose by Claude with web
          search, prices from Yahoo Finance.
        </div>
      </article>
    </div>
  );
}
