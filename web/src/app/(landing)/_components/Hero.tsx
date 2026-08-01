import Link from "next/link";
import { ArrowIcon } from "./LandingNav";
import { DashboardPreview } from "./DashboardPreview";

export function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-5 px-4 pt-16 pb-4">
        <span className="rise rise-1 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground shadow-sm">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-up" />
          </span>
          live · AI-powered multi-fund investing
        </span>
        <h1 className="rise rise-2 max-w-2xl text-left text-4xl font-extrabold tracking-tight text-balance md:text-6xl">
          Your portfolio, with an <span className="text-primary">analyst that never sleeps.</span>
        </h1>
        <p className="rise rise-3 max-w-xl text-left text-base text-muted-foreground md:text-lg">
          Meridian runs three strategies in one dashboard — long-term compounding, systematic SIPs, and active swing
          trades — each with live data and AI insights on every holding.
        </p>
        <div className="rise rise-4 flex flex-wrap items-center gap-3 pt-2">
          <Link
            className="group inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/25 transition hover:shadow-lg hover:shadow-primary/35"
            href="/dashboard"
          >
            Open the dashboard
            <ArrowIcon />
          </Link>
          <a
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition hover:border-faint"
            href="#funds"
          >
            See the funds
          </a>
        </div>
        <div className="rise rise-4 text-xs text-faint">No card required · mock prototype · explore with sample funds</div>
      </div>
      <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16">
        <DashboardPreview />
      </div>
    </section>
  );
}
