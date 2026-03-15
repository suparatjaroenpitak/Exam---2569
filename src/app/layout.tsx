import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, Manrope } from "next/font/google";

import "@/app/globals.css";
import { PreferencesProvider } from "@/components/preferences-provider";

const headingFont = Manrope({
  subsets: ["latin"],
  variable: "--font-heading"
});

const bodyFont = IBM_Plex_Sans_Thai({
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "Online Exam Practice System",
  description: "Practice Thai, English, Mathematics, and Thai Law exams with PDF import and Typhoon2 Thai AI question generation."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className={`${headingFont.variable} ${bodyFont.variable} font-[family-name:var(--font-body)] antialiased`}>
        <PreferencesProvider>{children}</PreferencesProvider>
      </body>
    </html>
  );
}
