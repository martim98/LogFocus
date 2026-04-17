import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "LogFocus",
  description: "A timer-first productivity workspace built for calm, focused days.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="grain">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
