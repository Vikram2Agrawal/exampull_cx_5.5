import { type NextRequest, NextResponse } from "next/server";
import { verifyAdminSessionToken } from "@/lib/admin/session";

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	if (!pathname.startsWith("/admin")) {
		return NextResponse.next();
	}

	if (pathname === "/admin/sign-in") {
		return NextResponse.next();
	}

	const session = await verifyAdminSessionToken(request.cookies.get("admin_session")?.value);

	if (!session) {
		return new NextResponse("Not found", { status: 404 });
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/admin/:path*"],
};
