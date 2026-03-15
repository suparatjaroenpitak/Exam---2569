"use client";

import Link from "next/link";

import { usePreferences } from "@/components/preferences-provider";
import { PreferenceControls } from "@/components/ui/preference-controls";

export default function HomePage() {
  const { translate } = usePreferences();

  return (
    <main className="min-h-screen bg-mist bg-halo text-ink dark:text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-end">
          <PreferenceControls />
        </div>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">{translate("home.eyebrow")}</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50 sm:text-6xl">
              {translate("home.title")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              {translate("home.description")}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200" href="/login">
                {translate("home.login")}
              </Link>
              <Link className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-300 dark:hover:text-white" href="/register">
                {translate("home.register")}
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{translate("home.features")}</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <li>{translate("home.feature.auth")}</li>
                <li>{translate("home.feature.storage")}</li>
                <li>{translate("home.feature.pdf")}</li>
                <li>{translate("home.feature.nlp")}</li>
                <li>{translate("home.feature.runner")}</li>
              </ul>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-panel dark:bg-slate-800">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">{translate("home.categories")}</p>
                <p className="mt-3 text-3xl font-bold">4</p>
              </div>
              <div className="rounded-[2rem] bg-white/90 p-5 shadow-panel backdrop-blur dark:bg-slate-950/80">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{translate("home.storage")}</p>
                <p className="mt-3 text-3xl font-bold text-slate-950 dark:text-slate-100">XLSX</p>
              </div>
              <div className="rounded-[2rem] bg-amber-100 p-5 shadow-panel">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-800">{translate("home.timer")}</p>
                <p className="mt-3 text-3xl font-bold text-amber-950">1:1</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
