"use client";

import Link from "next/link";

import { usePreferences } from "@/components/preferences-provider";
import { BrandMark } from "@/components/ui/brand-mark";
import { PreferenceControls } from "@/components/ui/preference-controls";

export default function HomePage() {
  const { translate } = usePreferences();

  return (
    <main className="theme-screen">
      <div className="absolute right-4 top-4 z-10 sm:right-8 sm:top-8">
        <PreferenceControls />
      </div>
      <section className="mx-auto flex min-h-screen max-w-screen-xl items-center justify-center px-4 py-20 sm:px-6 lg:px-8">
        <div className="w-full max-w-4xl text-center">
          <div className="mx-auto flex w-fit flex-col items-center">
            <BrandMark className="h-[108px] w-[132px]" />
          </div>
          <h1 className="theme-title mx-auto mt-12 max-w-4xl text-4xl sm:text-6xl">
            {translate("home.title")}
          </h1>
          <p className="theme-muted mx-auto mt-6 max-w-2xl text-base leading-8 sm:text-lg">
            {translate("home.description")}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link className="theme-button-primary min-w-40 rounded-md px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em]" href="/login">
              {translate("home.login")}
            </Link>
            <Link className="theme-button-secondary min-w-40 rounded-md px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em]" href="/register">
              {translate("home.register")}
            </Link>
          </div>
          <div className="mt-14 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {["home.feature.auth", "home.feature.storage", "home.feature.pdf", "home.feature.nlp", "home.feature.runner"].map((key) => (
              <div key={key} className="theme-card-soft rounded-xl px-4 py-4 text-left text-sm leading-6 text-white/78">
                {translate(key)}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
