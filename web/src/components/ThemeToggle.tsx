"use client";

import { useState } from "react";

// Flips the `dark` class on <html> (the CSS variables in globals.css do the rest).
export function ThemeToggle({ className, onToggle }: { className: string; onToggle?: () => void }) {
  const [dark, setDark] = useState(false);
  return (
    <button
      type="button"
      className={className}
      title="Toggle theme"
      onClick={() => {
        const next = !dark;
        document.documentElement.classList.toggle("dark", next);
        setDark(next);
        onToggle?.();
      }}
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}
