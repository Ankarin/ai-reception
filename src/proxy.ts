import { NextResponse } from "next/server";

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
const isSignupRoute = createRouteMatcher(["/sign-up(.*)"]);
const isCorsRoute = createRouteMatcher([
  "/widget(.*)",
  "/chat",
  "/chat/(.*)",
  "/api/chat(.*)",
  "/api/organizations/(.+)/widget-settings",
]);
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/privacy",
  "/terms",
  "/hipaa",
  "/widget(.*)",
  "/chat",
  "/chat/(.*)",
  "/api/chat(.*)",
  "/api/organizations/(.+)/widget-settings",
  "/api/health",
  "/iframe-test(.*)",
]);
const isCronRoute = createRouteMatcher(["/api/cron/(.*)"]);
const isOrgRoute = createRouteMatcher([
  "/:orgId/dashboard(.*)",
  "/:orgId/widget-settings(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isCronRoute(req)) {
    return NextResponse.next();
  }

  if (isCorsRoute(req)) {
    if (req.method === "OPTIONS") {
      const response = new NextResponse(null, { status: 200 });
      response.headers.delete("X-Frame-Options");
      response.headers.set("Content-Security-Policy", "frame-ancestors *");
      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
      response.headers.set("Access-Control-Max-Age", "86400");
      return response;
    }

    const response = NextResponse.next();
    response.headers.delete("X-Frame-Options");
    response.headers.set("Content-Security-Policy", "frame-ancestors *");
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    return response;
  }

  const { userId, orgId } = await auth();

  // Redirect authenticated users away from auth pages to dashboard
  if (userId && isAuthRoute(req)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  if (isSignupRoute(req)) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  if (!userId && !isAuthRoute(req)) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  if (isOrgRoute(req) && userId) {
    const pathname = req.nextUrl.pathname;
    const orgIdMatch =
      pathname.match(/\/([^/]+)\/(dashboard|widget-settings)/)?.[1];

    if (orgIdMatch && orgId !== orgIdMatch) {
      console.error("[Middleware] Organization mismatch - Access denied");
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Exclude chat/widget routes from Clerk middleware entirely to prevent iframe session conflicts
    "/((?!_next|chat|widget|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api(?!/chat)|trpc)(.*)",
  ],
};
