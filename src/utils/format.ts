import clsx, { type ClassValue } from "clsx";

import { getIntlLocale, type Locale } from "@/i18n";

export function cn(...values: ClassValue[]) {
  return clsx(values);
}

export function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function formatDateTime(value: string, locale: Locale = "en") {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
