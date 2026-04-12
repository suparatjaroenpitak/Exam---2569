"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/logout-button";
import { PreferenceControls } from "@/components/ui/preference-controls";
import { BrandMark } from "@/components/ui/brand-mark";
import { usePreferences } from "@/components/preferences-provider";
import type { PublicUser } from "@/lib/types";

export function AppShell(props: {
  user: PublicUser;
  title: string;
  subtitle: string;
  titleKey?: string;
  subtitleKey?: string;
  children: ReactNode;
}) {
  const { translate } = usePreferences();
  const title = props.titleKey ? translate(props.titleKey, props.title) : props.title;
  const subtitle = props.subtitleKey ? translate(props.subtitleKey, props.subtitle) : props.subtitle;

  return (
    <div className="theme-screen">
      <header className="sticky top-0 z-20">
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="theme-card rounded-[2rem] px-5 py-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
                <div className="flex items-center gap-4">
                  <BrandMark className="h-14 w-14 rounded-[1.4rem]" />
                  <div>
                    <p className="theme-kicker text-[10px] font-semibold">{translate("app.title")}</p>
                    <p className="mt-1 text-sm text-white/72">
                      {props.user.name} • {translate(`role.${props.user.role}`, props.user.role)}
                    </p>
                  </div>
                </div>
                <nav className="flex flex-wrap items-center gap-2">
                  <Link className="theme-nav-link rounded-full px-4 py-2 text-sm font-medium" href="/dashboard">
                    {translate("nav.dashboard")}
                  </Link>
                  <Link className="theme-nav-link rounded-full px-4 py-2 text-sm font-medium" href="/exam">
                    {translate("nav.exam")}
                  </Link>
                  {props.user.role === "admin" ? (
                    <Link className="theme-nav-link rounded-full px-4 py-2 text-sm font-medium" href="/admin">
                      {translate("nav.admin")}
                    </Link>
                  ) : null}
                </nav>
              </div>
              <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                <PreferenceControls />
                <LogoutButton />
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="theme-card mb-8 rounded-[2rem] p-6 sm:p-8">
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white">{title}</h2>
          <p className="theme-muted mt-3 max-w-3xl text-base leading-7">{subtitle}</p>
        </section>
        {props.children}
      </main>
    </div>
  );
}
