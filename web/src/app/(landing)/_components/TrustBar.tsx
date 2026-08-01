export function TrustBar() {
  return (
    <section className="py-10 text-center">
      <div className="mx-auto w-full max-w-5xl px-4">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-faint">
          Live market data &amp; fundamentals powered by
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-60">
          <span className="text-lg font-bold tracking-tight text-muted-foreground">Market·MCP</span>
          <span className="text-lg font-bold tracking-tight text-muted-foreground">NewsRank AI</span>
          <span className="text-lg font-bold tracking-tight text-muted-foreground">Chart.js</span>
          <span className="text-lg font-bold tracking-tight text-muted-foreground">Skill Engine</span>
          <span className="text-lg font-bold tracking-tight text-muted-foreground">UAE&nbsp;4.5%</span>
        </div>
      </div>
    </section>
  );
}
