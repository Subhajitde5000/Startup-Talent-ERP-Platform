import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DialogAccessibility } from "@/components/shared/DialogAccessibility";

/*
 * Fonts are self-hosted so the production build never depends on Google Fonts.
 * Open Sans is licensed under the Apache License 2.0.
 */
const openSans = localFont({
  src: [
    {
      path: "../assets/fonts/OpenSans-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/OpenSans-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../assets/fonts/OpenSans-Italic.ttf",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Meridian — Startup & Talent ERP",
    template: "%s · Meridian",
  },
  description:
    "One calm workspace for founders, mentors and investors to plan stages, share evidence and work together.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={openSans.variable}>
      <body>
        <ThemeProvider>
          <DialogAccessibility />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
