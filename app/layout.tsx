import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { ClerkProvider } from "@clerk/nextjs";

function getAllowedRedirectOrigins() {
  const requestHeaders = headers();
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = requestHeaders.get("host");
  const currentOrigin = host ? `${forwardedProto ?? "http"}://${forwardedHost ?? host}` : null;

  return [
    currentOrigin,
    process.env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ].filter((origin): origin is string => Boolean(origin));
}

export const metadata: Metadata = {
  title: "Sister Focus",
  description: "A timer-first productivity workspace built for calm, focused days.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="grain">
        <ClerkProvider allowedRedirectOrigins={getAllowedRedirectOrigins()}>
          <AppShell>{children}</AppShell>
        </ClerkProvider>
      </body>
    </html>
  );
}
