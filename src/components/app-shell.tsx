"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/logout-button";
import { PreferenceControls } from "@/components/ui/preference-controls";
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
    <div className="min-h-screen bg-mist bg-halo text-ink dark:text-slate-100">
      <header className="border-b border-slate-200/70 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{translate("app.title")}</p>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
            </div>
            <PreferenceControls />
          </div>
          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-2 md:flex">
              <Link className="rounded-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white" href="/dashboard">
                {translate("nav.dashboard")}
              </Link>
              <Link className="rounded-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white" href="/exam">
                {translate("nav.exam")}
              </Link>
              {props.user.role === "admin" ? (
                <Link className="rounded-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white" href="/admin">
                  {translate("nav.admin")}
                </Link>
              ) : null}
            </nav>
            <div className="hidden rounded-2xl bg-slate-100 px-3 py-2 text-right text-sm sm:block dark:bg-slate-900">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{props.user.name}</p>
              <p className="text-slate-500 dark:text-slate-400">{translate(`role.${props.user.role}`, props.user.role)}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-100">{title}</h2>
          <p className="mt-2 text-base text-slate-600 dark:text-slate-300">{subtitle}</p>
        </div>
        {props.children}
      </main>
    </div>
  );
}
