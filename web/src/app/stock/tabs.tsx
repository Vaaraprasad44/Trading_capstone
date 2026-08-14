"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  NEWS_FILTERS,
  communityFor,
  newsFor,
  notesFor,
  type Comment,
  type NewsCat,
  type Sentiment,
} from "./data";

/* ===== news — TradingView-style headline list with category filters ===== */

export function NewsTab({ ticker }: { ticker: string }) {
  const [cat, setCat] = useState<NewsCat | "all">("all");
  const all = useMemo(() => newsFor(ticker), [ticker]);
  const items = cat === "all" ? all : all.filter((n) => n.cat === cat);
  return (
    <div className="card card-pad">
      <div className="news-filters">
        {NEWS_FILTERS.map((fl) => (
          <button key={fl.key} className={"news-chip" + (cat === fl.key ? " on" : "")} onClick={() => setCat(fl.key)}>
            {fl.label}
          </button>
        ))}
      </div>
      {items.map((n, i) => (
        <div className="news-row" key={i}>
          <span className="news-time">{n.time}</span>
          <span className="news-h">{n.h}</span>
          <span className="news-src">{n.source}</span>
        </div>
      ))}
      {items.length === 0 && <div className="news-empty">No stories in this category for {ticker} yet.</div>}
    </div>
  );
}

/* ===== notes — the manager's trade journal for this stock ===== */

export function NotesTab({ ticker }: { ticker: string }) {
  const notes = notesFor(ticker);
  return (
    <>
      {notes.map((n) => (
        <div className="card card-pad note" key={n.title}>
          <div className="note-head">
            <span className={"note-act " + n.action.toLowerCase()}>{n.action}</span>
            <h2>{n.title}</h2>
            <span className="note-date">{n.date}</span>
          </div>
          <div className="note-by">
            <span className="note-av">PR</span> Preetham R · Fund manager
          </div>
          {n.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <div className="note-tags">
            {n.tags.map((t) => (
              <span className="tag-chip" key={t}>
                {t}
              </span>
            ))}
          </div>
          {n.image && (
            <div className="note-img">
              <Image src={n.image.src} alt={n.image.alt} width={2000} height={1626} style={{ width: "100%", height: "auto" }} />
              <div className="note-cap">{n.image.caption}</div>
            </div>
          )}
        </div>
      ))}
      <div className="foot-note">Notes are written by the fund manager to explain why each trade was taken.</div>
    </>
  );
}

/* ===== community — sentiment, composer and comment feed ===== */

const SENTIMENTS: Sentiment[] = ["Bullish", "Neutral", "Bearish"];

function CommentRow({ c }: { c: Comment }) {
  return (
    <div className="cmt">
      <div className="cmt-av" style={{ background: c.color }}>
        {c.user
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)}
      </div>
      <div className="cmt-main">
        <div className="cmt-meta">
          <span className="cmt-user">{c.user}</span>
          <span className={"senti " + c.sentiment.toLowerCase()}>{c.sentiment}</span>
          <span className="cmt-time">{c.time}</span>
        </div>
        <div className="cmt-text">{c.text}</div>
        <div className="cmt-foot">
          <span>♥ {c.likes}</span>
          <span>↩ {c.replies} replies</span>
        </div>
      </div>
    </div>
  );
}

export function CommunityTab({ ticker }: { ticker: string }) {
  const base = useMemo(() => communityFor(ticker), [ticker]);
  const [posted, setPosted] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [senti, setSenti] = useState<Sentiment>("Neutral");

  const post = () => {
    if (!text.trim()) return;
    setPosted((p) => [
      { user: "You", color: "var(--brand)", time: "just now", sentiment: senti, text: text.trim(), likes: 0, replies: 0 },
      ...p,
    ]);
    setText("");
  };

  return (
    <div className="card card-pad">
      <div className="senti-head">
        <h2>What the community thinks</h2>
        <span className="muted">{base.total} members hold {ticker}</span>
      </div>
      <div className="senti-bar">
        <div className="b" style={{ width: `${base.bullishPct}%` }} />
        <div className="s" style={{ width: `${100 - base.bullishPct}%` }} />
      </div>
      <div className="senti-legend">
        <span>▲ {base.bullishPct}% bullish</span>
        <span>▼ {100 - base.bullishPct}% bearish</span>
      </div>

      <div className="composer">
        <input
          type="text"
          placeholder={`Share your view on ${ticker}…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && post()}
        />
        <div className="senti-pick">
          {SENTIMENTS.map((s) => (
            <button key={s} className={senti === s ? "on" : ""} onClick={() => setSenti(s)}>
              {s}
            </button>
          ))}
        </div>
        <button className="post-btn" onClick={post}>
          Post
        </button>
      </div>

      {[...posted, ...base.comments].map((c, i) => (
        <CommentRow c={c} key={i} />
      ))}
    </div>
  );
}
