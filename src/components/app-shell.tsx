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
      <header className="relative z-20">
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <BrandMark className="h-14 w-14" />
                <div>
                  <p className="theme-kicker text-[10px] font-semibold">{translate("app.title")}</p>
                  <p className="mt-1 text-sm text-white/72">
                    {props.user.name} • {translate(`role.${props.user.role}`, props.user.role)}
                  </p>
                </div>
              </div>
              <nav className="flex flex-wrap items-center gap-2">
                <Link className="theme-nav-link rounded-md px-4 py-2 text-xs font-medium" href="/dashboard">
                  {translate("nav.dashboard")}
                </Link>
                <Link className="theme-nav-link rounded-md px-4 py-2 text-xs font-medium" href="/exam">
                  {translate("nav.exam")}
                </Link>
                {props.user.role === "admin" ? (
                  <Link className="theme-nav-link rounded-md px-4 py-2 text-xs font-medium" href="/admin">
                    {translate("nav.admin")}
                  </Link>
                ) : null}
              </nav>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <PreferenceControls />
              <LogoutButton />
            </div>
          </div>
          <div className="theme-outline-divider mt-6" />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="mb-8 max-w-4xl">
          <p className="theme-kicker text-[10px] font-semibold">{translate("app.title")}</p>
          <h2 className="theme-title mt-4 text-4xl sm:text-5xl">{title}</h2>
          <p className="theme-muted mt-4 max-w-3xl text-base leading-7">{subtitle}</p>
        </section>
        {props.children}
      </main>
    </div>
  );
}
