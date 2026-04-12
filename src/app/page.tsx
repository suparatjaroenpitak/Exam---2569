"use client";

import Link from "next/link";

import { usePreferences } from "@/components/preferences-provider";
import { BrandMark } from "@/components/ui/brand-mark";
import { PreferenceControls } from "@/components/ui/preference-controls";

export default function HomePage() {
  const { translate } = usePreferences();

  return (
    <main className="theme-screen">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-end">
          <PreferenceControls />
        </div>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="mb-6 flex items-center gap-4">
              <BrandMark className="h-20 w-20" />
              <p className="theme-kicker text-xs font-semibold">{translate("home.eyebrow")}</p>
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">
              {translate("home.title")}
            </h1>
            <p className="theme-muted mt-6 max-w-2xl text-base leading-8 sm:text-lg">
              {translate("home.description")}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link className="theme-button-primary rounded-2xl px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em]" href="/login">
                {translate("home.login")}
              </Link>
              <Link className="theme-button-secondary rounded-2xl px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em]" href="/register">
                {translate("home.register")}
              </Link>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="theme-card-soft rounded-[1.75rem] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-white/60">{translate("home.categories")}</p>
                <p className="mt-3 text-3xl font-semibold text-white">4</p>
              </div>
              <div className="theme-card-soft rounded-[1.75rem] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-white/60">{translate("home.storage")}</p>
                <p className="mt-3 text-3xl font-semibold text-white">Excel</p>
              </div>
              <div className="theme-card-soft rounded-[1.75rem] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-white/60">{translate("home.timer")}</p>
                <p className="mt-3 text-3xl font-semibold text-white">1:1</p>
              </div>
            </div>
          </div>

          <div className="theme-card relative overflow-hidden rounded-[2.5rem] p-8 sm:p-10">
            <div className="absolute -right-12 top-8 h-28 w-28 rounded-full bg-white/12 blur-3xl" />
            <div className="absolute -bottom-12 left-10 h-32 w-32 rounded-full bg-[#8cabff]/25 blur-3xl" />
            <div className="relative">
              <p className="theme-kicker text-xs font-semibold">{translate("home.features")}</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">Focused practice in a single flow</h2>
              <ul className="mt-6 space-y-4">
                {["home.feature.auth", "home.feature.storage", "home.feature.pdf", "home.feature.nlp", "home.feature.runner"].map((key) => (
                  <li key={key} className="flex items-start gap-3">
                    <span className="mt-2 h-2.5 w-2.5 rounded-full bg-white/85" />
                    <span className="theme-muted text-sm leading-7">{translate(key)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="theme-card-soft rounded-[1.75rem] p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/60">Adaptive workflow</p>
                  <p className="mt-3 text-lg font-semibold text-white">Login, generate, practice, review</p>
                </div>
                <div className="rounded-[1.75rem] bg-white px-5 py-6 text-[#2148c0] shadow-[0_18px_40px_rgba(5,13,42,0.26)]">
                  <p className="text-xs uppercase tracking-[0.24em] text-[#2148c0]/65">Exam cadence</p>
                  <p className="mt-3 text-3xl font-semibold">Ready now</p>
                  <p className="mt-2 text-sm leading-6 text-[#2148c0]/80">Structured for quick entry and low-friction practice.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
