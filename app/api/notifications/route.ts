import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
	clearNotifications,
	listUserNotifications,
	markAllNotificationsRead,
} from "@/lib/user/data";

export const runtime = "nodejs";

export async function GET() {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	const notifications = await listUserNotifications(user.uid);
	return NextResponse.json({ notifications });
}

export async function PATCH() {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	const result = await markAllNotificationsRead(user.uid);
	return NextResponse.json(result);
}

export async function DELETE() {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	const result = await clearNotifications(user.uid);
	return NextResponse.json(result);
}
