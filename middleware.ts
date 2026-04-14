import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/login(.*)", "/api/webhooks(.*)"]);

export default clerkMiddleware(
  async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect();
    }
  },
  (request) => {
    const appOrigin = new URL(request.url).origin;

    return {
      signInUrl: `${appOrigin}/login`,
      signUpUrl: `${appOrigin}/login`,
    };
  },
);

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/"],
};
