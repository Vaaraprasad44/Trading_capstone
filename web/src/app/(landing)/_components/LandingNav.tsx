import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2.5 text-[15px] font-semibold">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-white shadow-md shadow-primary/30">
            M
          </div>
          Meridian Capital
        </div>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a className="transition-colors hover:text-foreground" href="#funds">
            Funds
          </a>
          <Link className="transition-colors hover:text-foreground" href="/dashboard">
            Dashboard
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-sm text-muted-foreground transition-colors hover:text-foreground" />
          <Link
            className="group inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-white shadow-md shadow-primary/25 transition hover:shadow-lg hover:shadow-primary/35"
            href="/dashboard"
          >
            Open dashboard
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function ArrowIcon() {
  return (
    <svg
      className="size-3.5 -translate-x-0.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path d="M3 8h10m0 0L9 4m4 4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
