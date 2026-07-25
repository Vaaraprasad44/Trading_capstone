"use client";

import { useState } from "react";

// Flips data-theme on <html> (the CSS variables in globals.css do the rest).
export function ThemeToggle({ className, onToggle }: { className: string; onToggle?: () => void }) {
  const [dark, setDark] = useState(false);
  return (
    <button
      type="button"
      className={className}
      title="Toggle theme"
      onClick={() => {
        const next = !dark;
        document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
        setDark(next);
        onToggle?.();
      }}
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}
