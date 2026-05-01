import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyAdminSessionToken } from "@/lib/admin/session";

export async function requireAdminApiSession() {
	const cookieStore = await cookies();
	const session = await verifyAdminSessionToken(cookieStore.get("admin_session")?.value);

	if (!session) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	return null;
}
