import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function underConstruction(): boolean {
  return process.env.UNDER_CONSTRUCTION === "1";
}

function isBypassPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/.well-known") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!underConstruction()) {
    if (pathname === "/construction") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (pathname.startsWith("/admin")) {
      return updateSession(request);
    }
    return NextResponse.next();
  }

  if (isBypassPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/auth")) {
    return updateSession(request);
  }

  if (pathname === "/construction") {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/construction";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
