"use client";

import { useEffect } from "react";
import { LandingNav } from "./_components/LandingNav";
import { Hero } from "./_components/Hero";
import { TrustBar } from "./_components/TrustBar";
import { FundsSection } from "./_components/FundsSection";
import { Footer } from "./_components/Footer";
import "./landing.css";

export default function Landing() {
  // scroll reveal, as in the prototype
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    document.querySelectorAll(".landing .reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="landing">
      <LandingNav />
      <Hero />
      <TrustBar />
      <FundsSection />
      <Footer />
    </div>
  );
}
