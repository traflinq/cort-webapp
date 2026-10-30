import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function rewriteSaudiCompanyRoute(request: NextRequest, pathname: string) {
    if (pathname === "/sa" || pathname === "/sa/") {
        return NextResponse.rewrite(new URL("/company/login", request.url));
    }

    if (pathname.startsWith("/sa/")) {
        const rest = pathname.slice(3);
        const target = rest.startsWith("/company") ? rest : `/company${rest}`;
        return NextResponse.rewrite(new URL(target, request.url));
    }

    return null;
}

export function middleware(request: NextRequest) {
    const hostname = request.headers.get("host");
    const { pathname } = request.nextUrl;

    const saudiRewrite = rewriteSaudiCompanyRoute(request, pathname);
    if (saudiRewrite) {
        return saudiRewrite;
    }

    // Define domains
    const ADMIN_DOMAIN = "admin.traflinq.com";
    const PORTAL_DOMAIN = "portal.traflinq.com";
    const VENDOR_DOMAIN = "vendor.traflinq.com";

    // Public ride-share tracking links — reachable with no auth on every domain.
    // Short form: /r/<token>  ·  legacy: /ride-share?...
    if (pathname.startsWith("/ride-share") || pathname.startsWith("/r/") || pathname === "/r") {
        return NextResponse.next();
    }

    // Check if we are on the Vendor domain
    if (hostname && hostname.includes(VENDOR_DOMAIN)) {
        // Redirect root to login
        if (pathname === "/") {
            return NextResponse.rewrite(new URL("/vendor/login", request.url));
        }

        if (
            !pathname.startsWith("/vendor") &&
            !pathname.startsWith("/cort-vendor") &&
            !pathname.startsWith("/admin") &&
            !pathname.startsWith("/company")
        ) {
            return NextResponse.rewrite(new URL(`/vendor${pathname}`, request.url));
        }
    }

    // Check if we are on the Admin domain
    if (hostname && hostname.includes(ADMIN_DOMAIN)) {
        // Redirect root to login
        if (pathname === "/") {
            return NextResponse.rewrite(new URL("/admin/login", request.url));
        }

        // Determine the new URL path
        // We want to serve content from /admin/* without showing /admin in the URL
        // So admin.traflinq.com/dashboard serves /admin/dashboard

        // If the path already starts with /admin (unlikely if we are hiding it, but possible),
        // we might not need to rewrite, or we might want to handle it.
        // However, usually we rewrite everything that doesn't start with /admin to /admin

        // Important: keep /company routes intact on the admin domain.
        // Otherwise, redirects from ProtectedRoute like "/company" will be
        // internally rewritten to "/admin/company" (not a real route),
        // resulting in a 404 ("Lost your way?").
        if (
            !pathname.startsWith("/admin") &&
            !pathname.startsWith("/company") &&
            !pathname.startsWith("/vendor") &&
            !pathname.startsWith("/cort-vendor")
        ) {
            return NextResponse.rewrite(new URL(`/admin${pathname}`, request.url));
        }
    }

    // Check if we are on the Portal/Company domain
    if (hostname && hostname.includes(PORTAL_DOMAIN)) {
        // Redirect root to login
        if (pathname === "/") {
            return NextResponse.rewrite(new URL("/company/login", request.url));
        }

        // Saudi portal entry: portal.traflinq.com/sa
        if (pathname === "/sa" || pathname === "/sa/") {
            return NextResponse.rewrite(new URL("/company/login", request.url));
        }

        // Similar logic for company portal, but keep /admin and /sa routes intact.
        // (ProtectedRoute can redirect admins to "/admin".)
        if (
            !pathname.startsWith("/company") &&
            !pathname.startsWith("/admin") &&
            !pathname.startsWith("/cort-vendor") &&
            !pathname.startsWith("/sa")
        ) {
            return NextResponse.rewrite(new URL(`/company${pathname}`, request.url));
        }
    }

    // Default behavior: allow request to proceed as is (e.g. for landing page on main domain)
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files with extensions (png, svg, jpg, jpeg, gif, webp)
         */
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
