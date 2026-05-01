import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser, userSessionCookieName } from "@/lib/auth/session";
import { deleteUserAccount } from "@/lib/user/data";

export const runtime = "nodejs";

export async function POST() {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	await deleteUserAccount(user);

	const cookieStore = await cookies();
	cookieStore.delete(userSessionCookieName);

	return NextResponse.json({ deleted: true });
}
