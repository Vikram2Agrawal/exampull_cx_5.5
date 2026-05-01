import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { exportUserData } from "@/lib/user/data";

export const runtime = "nodejs";

export async function GET() {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	const data = await exportUserData(user.uid);
	const body = JSON.stringify(data, null, 2);

	return new Response(body, {
		headers: {
			"Content-Type": "application/json",
			"Content-Disposition": `attachment; filename="exampull-export-${user.uid}.json"`,
			"Cache-Control": "private, no-store",
		},
	});
}
