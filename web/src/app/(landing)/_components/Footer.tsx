import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto w-full max-w-5xl px-4">
        <div className="grid grid-cols-2 gap-10 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 text-[15px] font-semibold">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-white shadow-md shadow-primary/30">
                M
              </div>
              Meridian Capital
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              An AI-powered multi-fund dashboard concept. Long-term compounding, systematic SIPs, and active swing
              trades — with insight on every holding.
            </p>
          </div>
          <div>
            <h5 className="mb-3 text-sm font-bold">Product</h5>
            <a className="mb-2 block text-sm text-muted-foreground transition-colors hover:text-primary" href="#funds">
              Funds
            </a>
            <Link className="mb-2 block text-sm text-muted-foreground transition-colors hover:text-primary" href="/dashboard">
              Dashboard
            </Link>
          </div>
          <div>
            <h5 className="mb-3 text-sm font-bold">Company</h5>
            <a className="mb-2 block text-sm text-muted-foreground transition-colors hover:text-primary" href="#">About</a>
            <a className="mb-2 block text-sm text-muted-foreground transition-colors hover:text-primary" href="#">Blog</a>
            <a className="mb-2 block text-sm text-muted-foreground transition-colors hover:text-primary" href="#">Careers</a>
            <a className="mb-2 block text-sm text-muted-foreground transition-colors hover:text-primary" href="#">Contact</a>
          </div>
          <div>
            <h5 className="mb-3 text-sm font-bold">Legal</h5>
            <a className="mb-2 block text-sm text-muted-foreground transition-colors hover:text-primary" href="#">Terms</a>
            <a className="mb-2 block text-sm text-muted-foreground transition-colors hover:text-primary" href="#">Privacy</a>
            <a className="mb-2 block text-sm text-muted-foreground transition-colors hover:text-primary" href="#">Disclosures</a>
            <a className="mb-2 block text-sm text-muted-foreground transition-colors hover:text-primary" href="#">Security</a>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-5 text-xs text-faint">
          <span>© 2026 Meridian Capital · Mock prototype</span>
          <span className="max-w-xl">
            Fake data for demonstration only. Not investment advice. Markets involve risk; past performance does not
            guarantee future results.
          </span>
        </div>
      </div>
    </footer>
  );
}
