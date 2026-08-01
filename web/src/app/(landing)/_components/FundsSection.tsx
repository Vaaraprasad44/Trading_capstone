import { FUNDS } from "../_data";

export function FundsSection() {
  return (
    <section className="py-20" id="funds">
      <div className="mx-auto w-full max-w-5xl px-4">
        <div className="reveal mx-auto mb-12 max-w-xl text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-primary">Three strategies, one login</div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
            Pick the fund that fits how you invest
          </h2>
          <p className="mt-4 text-muted-foreground">
            Switch between funds instantly. Each has its own dashboard, metrics, and AI coach tuned to the strategy.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {FUNDS.map((f) => (
            <div
              className="reveal flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl"
              key={f.name}
            >
              <span
                className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                style={f.badgeStyle}
              >
                {f.badge}
              </span>
              <h3 className="mt-4 text-xl font-bold tracking-tight">{f.name}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{f.desc}</p>
              <div className="mt-5 flex gap-6 border-t border-border pt-4">
                {f.stats.map((s) => (
                  <div key={s.l}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">{s.l}</div>
                    <div className="mt-1 text-lg font-bold tabular-nums" style={s.up ? { color: "var(--up)" } : undefined}>
                      {s.v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
