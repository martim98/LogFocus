import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid w-full gap-8 rounded-[28px] bg-[rgba(255,255,255,0.1)] p-6 text-white shadow-[0_24px_50px_rgba(0,0,0,0.16)] lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
        <div className="flex flex-col justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[rgba(255,255,255,0.78)]">Sister Focus</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Sign in to keep your timer and projects in sync.</h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-[rgba(255,255,255,0.8)]">
              Use Google or email login. The app is built so the workspace can move to a hosted backend later without
              changing the way people sign in.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-[rgba(255,255,255,0.78)]">
            <span className="rounded-full bg-[rgba(255,255,255,0.12)] px-4 py-2">Google login</span>
            <span className="rounded-full bg-[rgba(255,255,255,0.12)] px-4 py-2">Email magic link</span>
            <span className="rounded-full bg-[rgba(255,255,255,0.12)] px-4 py-2">Future sync-ready</span>
          </div>
          <Link href="/" className="inline-flex w-fit items-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-[rgb(var(--bg))]">
            Continue as guest
          </Link>
        </div>
        <div className="rounded-[24px] bg-white p-2 text-[rgb(var(--bg))] shadow-lg">
          <SignIn
            appearance={{
              elements: {
                card: "shadow-none border-0",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton: "rounded-md",
                formButtonPrimary: "rounded-md bg-[rgb(var(--bg))] hover:bg-[rgb(150,52,52)]",
              },
            }}
            routing="path"
            path="/login"
            signUpUrl="/login"
            forceRedirectUrl="/"
            fallbackRedirectUrl="/"
          />
        </div>
      </section>
    </main>
  );
}
